/**
 * Pure intent matcher for the chat input. Lives in its own module so
 * it's importable from a Node-side test runner without pulling React.
 *
 * Maps free-form chat input to a `Route` value. Returns `null` when
 * nothing matches — the caller (`App.tsx`'s `handleChatCommand`) can
 * then fall back to the generic "drop into the analyze panel with
 * the question echoed" path.
 *
 * Pattern order matters: more specific topic checks first, then
 * generic openers, then verb-driven nav (swap / liquidity / positions),
 * then bare-keyword nav. Each branch documents the test phrases it's
 * meant to cover.
 */
import type { TokenSymbol } from "./tokens.ts";
import type { FeeTier } from "@/features/liquidity/fee-tiers.ts";
import type { HookName } from "@/features/liquidity/use-create-pool.ts";

export type AnalyzeTopic =
  | "eth-price"
  | "eurc-peg"
  | "usdc-usdt-pool"
  | "top-rwa-tokens"
  | "cbbtc-24h-volume"
  | "mantua-hooks"
  | "token-price";

export interface PoolKeyCtx {
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  hook?: HookName | null;
}

export type Intent =
  | { kind: "home" }
  | { kind: "swap"; tokenIn?: TokenSymbol; tokenOut?: TokenSymbol }
  | { kind: "pools" }
  | { kind: "add-liquidity"; ctx?: PoolKeyCtx }
  | { kind: "positions" }
  | {
      kind: "analyze";
      topic?: AnalyzeTopic;
      question?: string;
      symbol?: string;
    };

const WALLET_TOKEN_ALIASES: { sym: TokenSymbol; aliases: string[] }[] = [
  { sym: "cbBTC", aliases: ["cbbtc", "cb-btc", "cbbct", "cb-bct", "cbtc"] },
  { sym: "EURC", aliases: ["eurc", "eucr"] },
  { sym: "USDC", aliases: ["usdc", "uscd"] },
  { sym: "WETH", aliases: ["weth"] },
  { sym: "ETH", aliases: ["eth", "ethereum", "eht"] },
];

export function extractWalletTokens(text: string): { sym: TokenSymbol; pos: number }[] {
  const t = text.toLowerCase();
  const claimed = new Array<boolean>(t.length).fill(false);
  const found: { sym: TokenSymbol; pos: number }[] = [];
  for (const entry of WALLET_TOKEN_ALIASES) {
    for (const alias of entry.aliases) {
      const re = new RegExp(`\\b${alias}\\b`, "g");
      let m;
      while ((m = re.exec(t)) !== null) {
        if (claimed[m.index]) continue;
        for (let i = m.index; i < m.index + alias.length; i++) claimed[i] = true;
        found.push({ sym: entry.sym, pos: m.index });
      }
    }
  }
  return found.sort((a, b) => a.pos - b.pos);
}

export function extractAnalyzeSymbol(text: string): string | null {
  const t = text.toLowerCase();
  const candidates: { canonical: string; patterns: string[] }[] = [
    { canonical: "bitcoin", patterns: ["bitcoin", "btc"] },
    { canonical: "ethereum", patterns: ["ethereum", "eth", "eht"] },
    { canonical: "cbbtc", patterns: ["cbbtc", "cbbct", "cb-btc", "cb-bct"] },
    { canonical: "usdc", patterns: ["usdc", "uscd"] },
    { canonical: "usdt", patterns: ["usdt"] },
    { canonical: "eurc", patterns: ["eurc", "eucr"] },
    { canonical: "weth", patterns: ["weth"] },
    { canonical: "solana", patterns: ["solana", "sol"] },
    { canonical: "maker", patterns: ["maker", "mkr"] },
    { canonical: "pendle", patterns: ["pendle"] },
    { canonical: "ondo", patterns: ["ondo"] },
    { canonical: "centrifuge", patterns: ["centrifuge"] },
  ];
  for (const c of candidates) {
    for (const p of c.patterns) {
      const re = new RegExp(`\\b${p}\\b`);
      if (re.test(t)) return c.canonical;
    }
  }
  return null;
}

function isStable(s: TokenSymbol): boolean {
  return s === "USDC" || s === "EURC";
}

export function detectIntent(text: string): Intent | null {
  const t = text.toLowerCase();

  if (/\bhook(s)?\b/.test(t) && /(learn|explain|what|tell|describe|how)/.test(t)) {
    return { kind: "analyze", topic: "mantua-hooks", question: text };
  }
  if (/\bcb.?btc\b/.test(t) && /(volume|trend|24h|24 ?hour)/.test(t)) {
    return { kind: "analyze", topic: "cbbtc-24h-volume", question: text };
  }
  if (
    /(rwa|real.?world.?asset)/.test(t) ||
    (/(top|best|leading)/.test(t) && /(token|asset)/.test(t) && /(rwa|real)/.test(t))
  ) {
    return { kind: "analyze", topic: "top-rwa-tokens", question: text };
  }
  if (/\beurc\b/.test(t) && /(peg|above|below|stable|deviation)/.test(t)) {
    return { kind: "analyze", topic: "eurc-peg", question: text };
  }
  if (/\busdc\b/.test(t) && /\busdt\b/.test(t)) {
    return { kind: "analyze", topic: "usdc-usdt-pool", question: text };
  }
  if (/(price|cost|worth|trading|value|how much)/.test(t)) {
    const sym = extractAnalyzeSymbol(text);
    if (sym) {
      return { kind: "analyze", topic: "token-price", question: text, symbol: sym };
    }
  }
  if (/^(analyze|research|tell me about|what is|show me)/.test(t)) {
    const sym = extractAnalyzeSymbol(text);
    if (sym) {
      return { kind: "analyze", topic: "token-price", question: text, symbol: sym };
    }
    return { kind: "analyze", question: text };
  }
  if (/\b(add|provide).*(liquidity|lp)\b/.test(t) || /^lp\b/.test(t)) {
    const tokens = extractWalletTokens(text);
    if (tokens.length >= 2) {
      const [a, b] = tokens;
      const fee: FeeTier = isStable(a!.sym) && isStable(b!.sym) ? 100 : 500;
      return {
        kind: "add-liquidity",
        ctx: { tokenA: a!.sym, tokenB: b!.sym, fee, hook: null },
      };
    }
    return { kind: "pools" };
  }
  if (/\b(swap|exchange|trade|convert)\b/.test(t)) {
    const tokens = extractWalletTokens(text);
    if (tokens.length >= 2) {
      const [a, b] = tokens;
      return { kind: "swap", tokenIn: a!.sym, tokenOut: b!.sym };
    }
    if (tokens.length === 1) {
      return { kind: "swap", tokenIn: tokens[0]!.sym };
    }
    return { kind: "swap" };
  }
  if (/\bposition/.test(t)) {
    return { kind: "positions" };
  }
  if (/\bpool|liquidity|\blp\b/.test(t)) {
    return { kind: "pools" };
  }
  return null;
}
