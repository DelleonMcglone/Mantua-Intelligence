import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { and, eq, gte } from "drizzle-orm";
import { env } from "../env.ts";
import { db } from "../db/client.ts";
import { mantuaAuditLog } from "../db/schema/safety.ts";
import { logAudit } from "./audit.ts";
import { logger } from "./logger.ts";

/**
 * x402 nanopayments (Phase 3) — a thin, injection-safe wrapper around the Circle
 * CLI (`circle services search/inspect/pay`). The agent uses this to pay small
 * USDC fees per call to the Circle services marketplace.
 *
 * LOCAL-ONLY by design: it requires the CLI installed, logged in, and a funded
 * CLI wallet (Base/Polygon). When `X402_ENABLED` is off or the CLI is absent
 * (e.g. on Vercel) `isX402Available()` returns false and callers fall back to the
 * free data tools.
 *
 * Security: every call uses execFile with an ARG ARRAY (never a shell string),
 * because the keyword/url/data originate from the model/user. Inputs are
 * validated; secrets and CLI payment logs are never surfaced — only cost + result.
 */

const execFileAsync = promisify(execFile);

const CLI_TIMEOUT_MS = 60_000;
const MAX_BUFFER = 8 * 1024 * 1024;
// Large x402 payment headers need a bigger HTTP header buffer (skill gotcha).
const CHILD_ENV = { ...process.env, NODE_OPTIONS: "--max-http-header-size=262144" };
const AVAIL_TTL_MS = 60_000;

export interface X402Service {
  name: string;
  description: string;
  price: string;
  chains: string[];
  url: string;
}

export interface X402InspectResult {
  price: number;
  method: string;
  chains: string[];
}

export interface X402CallResult {
  service: string;
  chain: string;
  usdCost: number;
  response: unknown;
}

/** Thrown when a paid call cannot proceed; `mayHaveCharged` flags ambiguous cases. */
export class X402Error extends Error {
  readonly mayHaveCharged: boolean;
  constructor(message: string, mayHaveCharged = false) {
    super(message);
    this.name = "X402Error";
    this.mayHaveCharged = mayHaveCharged;
  }
}

interface CliError extends Error {
  stdout?: string;
  stderr?: string;
}

async function runCli(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(env.CIRCLE_CLI_PATH, args, {
    timeout: CLI_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    env: CHILD_ENV,
  });
  return stdout;
}

function parseJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new X402Error("CLI returned non-JSON output");
  }
}

// ---- availability + wallet ----

let availCache: { value: boolean; at: number } | null = null;
let walletCache: string | null = null;

export async function isX402Available(): Promise<boolean> {
  if (!env.X402_ENABLED) return false;
  const now = Date.now();
  if (availCache && now - availCache.at < AVAIL_TTL_MS) return availCache.value;
  let value: boolean;
  try {
    await runCli(["--version"]);
    value = (await getCliWalletAddress()) !== null;
  } catch {
    value = false;
  }
  availCache = { value, at: now };
  return value;
}

export async function getCliWalletAddress(): Promise<string | null> {
  if (env.X402_WALLET_ADDRESS) return env.X402_WALLET_ADDRESS;
  if (walletCache) return walletCache;
  try {
    const out = parseJson(await runCli(["wallet", "list", "--type", "agent", "--output", "json"]));
    const list = Array.isArray(out)
      ? out
      : ((out as { wallets?: unknown[] } | null)?.wallets ?? []);
    for (const w of list as Array<Record<string, unknown>>) {
      const addr = w["address"];
      if (typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
        walletCache = addr;
        return addr;
      }
    }
  } catch (err) {
    logger.warn({ err }, "x402: wallet discovery failed");
  }
  return null;
}

// ---- input validation ----

function cleanKeyword(keyword: unknown): string {
  if (typeof keyword !== "string") throw new X402Error("keyword must be a string");
  // eslint-disable-next-line no-control-regex
  const k = keyword.replace(/[\x00-\x1f]/g, "").trim();
  if (k.length < 1 || k.length > 100) throw new X402Error("keyword must be 1–100 chars");
  return k;
}

function cleanUrl(url: unknown): string {
  if (typeof url !== "string") throw new X402Error("url must be a string");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new X402Error("url is not a valid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new X402Error("url must be http(s)");
  }
  return parsed.toString();
}

function cleanChain(chain: unknown, fallback: string): string {
  if (chain === undefined || chain === null) return fallback;
  if (typeof chain !== "string" || !/^[A-Za-z0-9_]{1,16}$/.test(chain)) {
    throw new X402Error("chain must be a short CLI chain code (e.g. BASE, MATIC)");
  }
  return chain.toUpperCase();
}

// ---- marketplace operations ----

/** First string/number-ish value, coerced to a string; avoids "[object Object]". */
function str(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
  }
  return "";
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        const c = o["chain"] ?? o["network"] ?? o["name"];
        return typeof c === "string" ? c : "";
      }
      return "";
    })
    .filter(Boolean);
}

export async function searchServices(keyword: unknown): Promise<X402Service[]> {
  const k = cleanKeyword(keyword);
  const out = parseJson(await runCli(["services", "search", k, "--output", "json"]));
  const rows = Array.isArray(out)
    ? out
    : ((out as { services?: unknown[] } | null)?.services ?? []);
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    name: str(r["name"], r["title"]) || "unknown",
    description: str(r["description"], r["summary"]),
    price: str(r["price"], r["priceUsd"], r["pricePerCall"]) || "?",
    chains: asStringArray(r["chains"] ?? r["accepts"] ?? r["acceptedChains"]),
    url: str(r["url"], r["serviceUrl"], r["endpoint"]),
  }));
}

export async function inspectService(url: string): Promise<X402InspectResult> {
  const out = parseJson(await runCli(["services", "inspect", url, "--output", "json"])) as Record<
    string,
    unknown
  >;
  return {
    price: toNumber(out["price"] ?? out["priceUsd"] ?? out["amount"]),
    method: (str(out["method"]) || "GET").toUpperCase(),
    chains: asStringArray(out["chains"] ?? out["accepts"] ?? out["acceptedChains"]),
  };
}

// ---- budget (summed from the audit log; no migration) ----

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getTodayX402Spend(): Promise<number> {
  const rows = await db
    .select({ params: mantuaAuditLog.params })
    .from(mantuaAuditLog)
    .where(
      and(eq(mantuaAuditLog.action, "agent_x402"), gte(mantuaAuditLog.createdAt, startOfUtcDay())),
    );
  let total = 0;
  for (const r of rows) {
    const cost = (r.params as Record<string, unknown> | null)?.["usdCost"];
    if (typeof cost === "number") total += cost;
  }
  return total;
}

// ---- pay (the orchestrated, agent-facing flow) ----

function detectChainHint(text: string): string | null {
  const retry = /--chain\s+([A-Za-z0-9_]+)/.exec(text);
  if (retry) return retry[1].toUpperCase();
  const accepted = /Accepted chains:\s*([A-Za-z0-9_]+)/i.exec(text);
  if (accepted) return accepted[1].toUpperCase();
  return null;
}

async function payOnce(args: {
  url: string;
  method: string;
  chain: string;
  address: string;
  data?: unknown;
  maxAmountUsd: number;
}): Promise<unknown> {
  const cli = [
    "services",
    "pay",
    args.url,
    "-X",
    args.method,
    "--address",
    args.address,
    "--chain",
    args.chain,
    "--max-amount",
    String(args.maxAmountUsd),
    "--output",
    "json",
  ];
  if (args.data !== undefined) cli.push("--data", JSON.stringify(args.data));
  return parseJson(await runCli(cli));
}

/**
 * Inspect → enforce budget → pay (with a single chain-hint retry) → audit.
 * Returns the endpoint's response plus the USD cost; throws X402Error on a
 * guarded failure (over-budget, schema 422, etc.).
 */
export async function callPaidService(opts: {
  url: unknown;
  data?: unknown;
  chain?: unknown;
}): Promise<X402CallResult> {
  const url = cleanUrl(opts.url);
  const address = await getCliWalletAddress();
  if (!address) throw new X402Error("No CLI wallet available");

  const inspected = await inspectService(url);
  const price = inspected.price;
  const perCall = env.X402_MAX_CALL_USD;
  if (price > perCall) {
    throw new X402Error(
      `Service costs $${String(price)}, over the per-call cap of $${String(perCall)}.`,
    );
  }
  const spent = await getTodayX402Spend();
  if (spent + price > env.X402_DAILY_CAP_USD) {
    throw new X402Error(
      `Daily x402 cap $${String(env.X402_DAILY_CAP_USD)} would be exceeded ($${String(spent)} spent today).`,
    );
  }

  let chain = cleanChain(opts.chain, env.X402_DEFAULT_CHAIN);
  let response: unknown;
  try {
    response = await payOnce({
      url,
      method: inspected.method,
      chain,
      address,
      data: opts.data,
      maxAmountUsd: perCall,
    });
  } catch (err) {
    const e = err as CliError;
    const text = `${e.stderr ?? ""}\n${e.stdout ?? ""}\n${e.message}`;
    // Post-authorization failure — funds may have moved; never blind-retry.
    if (/PAYMENT WAS SUBMITTED/i.test(text)) {
      await logAudit({
        action: "agent_x402",
        outcome: "failure",
        params: { url, chain, reason: "payment_submitted_no_content" },
      });
      throw new X402Error("Payment may have settled but the service did not return data.", true);
    }
    // Schema mismatch (pre-flight) — not charged; safe to surface, do NOT retry.
    if (/422|Payment was NOT charged|Check required parameters/i.test(text)) {
      throw new X402Error("The paid service rejected the request (wrong parameters). Not charged.");
    }
    // Chain rejection — retry once on the hinted chain.
    const hint = /does not accept --chain/i.test(text) ? detectChainHint(text) : null;
    if (hint && hint !== chain) {
      chain = hint;
      response = await payOnce({
        url,
        method: inspected.method,
        chain,
        address,
        data: opts.data,
        maxAmountUsd: perCall,
      });
    } else {
      logger.warn({ err }, "x402: pay failed");
      throw new X402Error("Paid call failed.");
    }
  }

  await logAudit({
    walletAddress: address,
    action: "agent_x402",
    outcome: "success",
    params: { url, chain, method: inspected.method, usdCost: price },
  });

  return { service: url, chain, usdCost: price, response };
}
