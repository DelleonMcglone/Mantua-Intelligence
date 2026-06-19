import Anthropic from "@anthropic-ai/sdk";
import { asc, eq } from "drizzle-orm";
import { isAddress, formatUnits } from "viem";
import { env } from "../env.ts";
import { db } from "../db/client.ts";
import { chatMessages, chatSessions } from "../db/schema/chat.ts";
import { users } from "../db/schema/users.ts";
import { logger } from "./logger.ts";
import { TOKEN_SYMBOLS, getToken, type TokenSymbol } from "./tokens.ts";
import { getOrCreateAgentWallet, getAgentWallet, updateAgentWalletCap } from "./agent-wallet.ts";
import { sendFromAgentWallet } from "./agent-send.ts";
import { swapFromAgentWallet, quoteAgentSwap } from "./agent-swap.ts";
import { getAgentPortfolio } from "./agent-portfolio.ts";
import { runAnalyze, topicSchema } from "./analyze.ts";

/**
 * Conversational, autonomous agent loop.
 *
 * Unlike the parse-only `agent-nlp.ts`, this runs a real tool-use loop: Claude
 * calls a tool, the SERVER executes it inline against the user's server-custodied
 * Circle wallet, the result is fed back, and the model continues until it
 * produces a final natural-language reply. There is NO per-action confirmation —
 * the daily spending cap (enforced inside the execution fns) is the guardrail.
 *
 * Capabilities exposed (per product decision): manage wallet, swap, send, and
 * read-only data/portfolio. Liquidity is intentionally NOT exposed here.
 *
 * Emitted as an async generator of `AgentChatEvent`s so the route can stream
 * them over SSE (assistant text deltas + live tool-step status).
 */

const MODEL = "claude-opus-4-8";
const MAX_TOOL_ROUNDS = 8;
const HISTORY_LIMIT = 20;

export class AnthropicUnavailableError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY not configured. The agent is unavailable.");
    this.name = "AnthropicUnavailableError";
  }
}

let cachedClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (cachedClient) return cachedClient;
  if (!env.ANTHROPIC_API_KEY) throw new AnthropicUnavailableError();
  cachedClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cachedClient;
}

/** Test-only escape hatch. */
export function setAnthropicForTesting(client: Anthropic | null): void {
  cachedClient = client;
}

export type AgentChatEvent =
  | { type: "session"; sessionId: string }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; tool: string; ok: boolean; data?: unknown; error?: string }
  | { type: "done" }
  | { type: "error"; message: string };

interface ToolStep {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  data?: unknown;
  error?: string;
}

const SYSTEM_PROMPT = `You are Mantua's autonomous on-chain agent. You operate a server-custodied Circle wallet on Arc Testnet (Circle's USDC-gas chain) on behalf of the signed-in user, and you converse in plain language.

Behaviour:
- You execute actions AUTONOMOUSLY. Do NOT ask for confirmation before swapping or sending — just do it and report the result. The user's daily USD spending cap is the safety guardrail; if an action would breach it the tool returns an error, which you relay plainly.
- DO ask a brief clarifying question (in plain text, no tool) only when a REQUIRED parameter is genuinely missing or ambiguous (e.g. "send 10 USDC" with no recipient address).
- After a tool runs, summarise what happened in one or two sentences. When a transaction succeeds, mention the token amounts; the UI shows the tx hash + explorer link, so you don't need to paste the raw hash.
- Be concise and direct. No preamble like "Sure, I can help with that."

Capabilities: manage the agent wallet (view info, set the daily cap), swap tokens, send tokens, fetch market/on-chain data, and read the wallet's portfolio. You CANNOT manage liquidity positions — if asked, say liquidity isn't available through you yet.

Supported tokens (case-sensitive symbols): ${TOKEN_SYMBOLS.join(", ")}.

Conventions:
- Amounts are decimal strings in human units (e.g. "1.5"), never atomic/wei.
- Addresses are 0x-prefixed 40-hex EVM addresses.
- The wallet already exists (auto-provisioned); use get_portfolio for balances and manage_wallet for cap/info.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_portfolio",
    description:
      "Read the agent wallet's current token balances (USDC/EURC/cirBTC) and recent transactions. Read-only.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "manage_wallet",
    description:
      "View agent-wallet info (address, status, daily USD cap) or set the daily USD cap.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["info", "set_cap"] },
        dailyCapUsd: {
          type: "number",
          minimum: 0,
          maximum: 50_000,
          description: "Required when action=set_cap.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "get_swap_quote",
    description:
      "Get a read-only quote for how much tokenOut the agent would receive swapping amountIn of tokenIn. Does not execute.",
    input_schema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", description: "Symbol to swap from." },
        tokenOut: { type: "string", description: "Symbol to swap into." },
        amountIn: { type: "string", description: "Decimal amount of tokenIn." },
      },
      required: ["tokenIn", "tokenOut", "amountIn"],
    },
  },
  {
    name: "swap",
    description:
      "Execute a token swap from the agent wallet via Uniswap on Arc. Input is denominated in tokenIn. Executes immediately.",
    input_schema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", description: "Symbol to swap from." },
        tokenOut: { type: "string", description: "Symbol to swap into." },
        amountIn: { type: "string", description: "Decimal amount of tokenIn." },
      },
      required: ["tokenIn", "tokenOut", "amountIn"],
    },
  },
  {
    name: "send",
    description: "Send tokens from the agent wallet to an address. Executes immediately.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient address (0x...)." },
        token: { type: "string", description: "Token symbol." },
        amount: { type: "string", description: "Decimal amount in human units." },
      },
      required: ["to", "token", "amount"],
    },
  },
  {
    name: "get_market_data",
    description:
      "Fetch read-only market / on-chain data (CoinGecko + DefiLlama + Arc pools) for a known topic. Use for prices, volumes, peg status, pool stats, market summaries. For an arbitrary token price use topic 'token-price' with a symbol.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "One of the supported analyze topics." },
        symbol: {
          type: "string",
          description: "Token symbol, only for topic 'token-price' (e.g. BTC, ETH, SOL).",
        },
      },
      required: ["topic"],
    },
  },
];

interface ToolInput {
  [k: string]: unknown;
}

function isTokenSymbol(s: unknown): s is TokenSymbol {
  return typeof s === "string" && (TOKEN_SYMBOLS as string[]).includes(s);
}

/** Execute one tool call. Throws are caught by the caller and surfaced as tool errors. */
async function executeTool(privyUserId: string, name: string, input: ToolInput): Promise<unknown> {
  switch (name) {
    case "get_portfolio": {
      const p = await getAgentPortfolio(privyUserId);
      return {
        address: p.address,
        balances: p.balances.map((b) => ({
          symbol: b.symbol,
          balance: formatUnits(BigInt(b.balanceRaw), b.decimals),
          usdValue: b.usdValue,
        })),
        recentTransactions: p.transactions.slice(0, 5),
      };
    }
    case "manage_wallet": {
      const action = input["action"];
      if (action === "set_cap") {
        const cap = input["dailyCapUsd"];
        if (typeof cap !== "number")
          throw new Error("dailyCapUsd (number) is required for set_cap");
        const w = await updateAgentWalletCap(privyUserId, cap);
        return { address: w.address, dailyCapUsd: w.dailyCapUsd, status: w.status };
      }
      const w = await getAgentWallet(privyUserId);
      if (!w) throw new Error("No agent wallet provisioned.");
      return { address: w.address, dailyCapUsd: w.dailyCapUsd, status: w.status };
    }
    case "get_swap_quote": {
      const { tokenIn, tokenOut, amountIn } = input;
      if (!isTokenSymbol(tokenIn) || !isTokenSymbol(tokenOut)) {
        throw new Error(`tokens must be one of: ${TOKEN_SYMBOLS.join(", ")}`);
      }
      const q = await quoteAgentSwap({ tokenIn, tokenOut, amountIn: String(amountIn) });
      return {
        tokenIn: q.tokenIn,
        tokenOut: q.tokenOut,
        amountIn: formatUnits(BigInt(q.amountInRaw), getToken(q.tokenIn).decimals),
        amountOut: formatUnits(BigInt(q.amountOutRaw), getToken(q.tokenOut).decimals),
      };
    }
    case "swap": {
      const { tokenIn, tokenOut, amountIn } = input;
      if (!isTokenSymbol(tokenIn) || !isTokenSymbol(tokenOut)) {
        throw new Error(`tokens must be one of: ${TOKEN_SYMBOLS.join(", ")}`);
      }
      const r = await swapFromAgentWallet({
        privyUserId,
        tokenIn,
        tokenOut,
        amountIn: String(amountIn),
      });
      return {
        txHash: r.txHash,
        explorerUrl: r.explorerUrl,
        tokenIn: r.tokenIn,
        tokenOut: r.tokenOut,
        amountIn: formatUnits(BigInt(r.amountInRaw), getToken(r.tokenIn).decimals),
        amountOut: formatUnits(BigInt(r.amountOutRaw), getToken(r.tokenOut).decimals),
        usdValue: r.usdValue,
      };
    }
    case "send": {
      const { to, token, amount } = input;
      if (typeof to !== "string" || !isAddress(to)) {
        throw new Error("`to` must be a valid 0x EVM address.");
      }
      if (!isTokenSymbol(token)) {
        throw new Error(`token must be one of: ${TOKEN_SYMBOLS.join(", ")}`);
      }
      const r = await sendFromAgentWallet({
        privyUserId,
        to,
        symbol: token,
        amount: String(amount),
      });
      return {
        txHash: r.txHash,
        explorerUrl: r.explorerUrl,
        amount: r.amountDecimal,
        symbol: r.symbol,
        to: r.to,
        usdValue: r.usdValue,
      };
    }
    case "get_market_data": {
      const parsed = topicSchema.safeParse(input["topic"]);
      if (!parsed.success) {
        throw new Error(`Unknown topic. Provide a supported analyze topic.`);
      }
      const symbol = typeof input["symbol"] === "string" ? input["symbol"] : undefined;
      return await runAnalyze(parsed.data, symbol);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** Map persisted chat rows into Anthropic message params (text turns only). */
async function loadHistory(sessionId: string): Promise<Anthropic.MessageParam[]> {
  const rows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
  return rows
    .slice(-HISTORY_LIMIT)
    .filter((r) => (r.role === "user" || r.role === "assistant") && r.content.trim().length > 0)
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

async function resolveUserId(privyUserId: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);
  return rows.at(0)?.id ?? null;
}

/**
 * Run one conversational turn, streaming events. Persists the user message and
 * the final assistant message (with a compact tool trace in `parsedIntent`).
 */
export async function* runAgentChat(params: {
  privyUserId: string;
  walletAddress?: string | undefined;
  sessionId?: string | undefined;
  message: string;
}): AsyncGenerator<AgentChatEvent> {
  const { privyUserId, walletAddress, message } = params;
  const client = getAnthropic();

  // Ensure the agent wallet exists so swap/send have something to act on.
  await getOrCreateAgentWallet(privyUserId, walletAddress);

  const userDbId = await resolveUserId(privyUserId);
  if (!userDbId) {
    yield { type: "error", message: "User record not found." };
    return;
  }

  // Resolve or create the conversation session.
  let sessionId = params.sessionId;
  if (sessionId) {
    const owned = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);
    if (owned.at(0)?.id !== sessionId) sessionId = undefined;
  }
  if (!sessionId) {
    const created = await db
      .insert(chatSessions)
      .values({ userId: userDbId, mode: "agent", title: message.slice(0, 80) })
      .returning({ id: chatSessions.id });
    sessionId = created[0].id;
  }
  yield { type: "session", sessionId };

  const history = await loadHistory(sessionId);
  await db.insert(chatMessages).values({ sessionId, role: "user", content: message });

  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: message }];
  const steps: ToolStep[] = [];
  let assistantText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });

    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        assistantText += ev.delta.text;
        yield { type: "text", delta: ev.delta.text };
      }
    }

    const final = await stream.finalMessage();
    messages.push({ role: "assistant", content: final.content });

    if (final.stop_reason !== "tool_use") break;

    const toolUses = final.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const args = (tu.input ?? {}) as Record<string, unknown>;
      yield { type: "tool_start", id: tu.id, tool: tu.name, args };
      try {
        const data = await executeTool(privyUserId, tu.name, args);
        steps.push({ tool: tu.name, args, ok: true, data });
        yield { type: "tool_result", id: tu.id, tool: tu.name, ok: true, data };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(data),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        steps.push({ tool: tu.name, args, ok: false, error: errMsg });
        yield { type: "tool_result", id: tu.id, tool: tu.name, ok: false, error: errMsg };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify({ error: errMsg }),
          is_error: true,
        });
        logger.warn({ err, tool: tu.name }, "agent tool execution failed");
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  await db.insert(chatMessages).values({
    sessionId,
    role: "assistant",
    content: assistantText,
    parsedIntent: steps.length > 0 ? { steps } : null,
  });

  yield { type: "done" };
}
