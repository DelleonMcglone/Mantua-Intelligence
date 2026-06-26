import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.ts";
import { getAnthropic, type AgentChatEvent } from "./agent-chat.ts";
import { runAnalyze, topicSchema, TOPICS } from "./analyze.ts";
import { getTradeSignals } from "./agent-signals.ts";
import { TOKEN_SYMBOLS, type TokenSymbol } from "./tokens.ts";

/**
 * Conversational, READ-ONLY research analyst.
 *
 * The wallet agent (agent-chat.ts) is auth-gated and can move funds; this is its
 * sibling for the "analyze" surface: a public, stateless Q&A loop with only
 * read tools (live market/on-chain data + the deterministic analyze runners).
 * No wallet, no DB, no session — the client owns the thread and replays prior
 * turns via `history`. Emits the same `AgentChatEvent` stream the wallet agent
 * does so the client SSE reader + bubble renderer are reused verbatim.
 */

const MODEL = "claude-opus-4-8";
const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `You are Mantua's research analyst — a read-only assistant for stablecoins, on-chain markets, and the Mantua protocol on Arc Testnet (Circle's USDC-gas chain). You answer questions; you do NOT and CANNOT move funds, swap, send, or change settings (that's the separate wallet agent).

Behaviour:
- Ground every factual claim in the tools. Call get_market_data for prices, pegs, volumes, pool stats, market summaries, or the Mantua hooks; call get_signals for live peg deviation + spot + price-impact snapshots. Cite the figures you used; never invent numbers.
- get_market_data takes a known topic. Supported topics: ${TOPICS.join(", ")}. For an arbitrary token's price use topic "token-price" with a symbol (e.g. BTC, ETH, SOL).
- Be concise and direct — a few sentences. No preamble like "Sure, I can help". If a question is outside markets/Mantua, say briefly what you can analyze instead.
- Plain text only — NO Markdown: no **bold**, no headings, no backticks, no "- "/"* " bullet lists. Write in sentences. Write full URLs (e.g. https://...) so the UI can link them.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_market_data",
    description:
      "Fetch read-only market / on-chain data (CoinGecko + DefiLlama + Arc pools) for a known topic. Use for prices, volumes, peg status, pool stats, market summaries, or Mantua hook info. For an arbitrary token price use topic 'token-price' with a symbol.",
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
  {
    name: "get_signals",
    description:
      "Read live decision signals: peg deviations (USDC/EURC), spot prices, and quote-implied price impact. Pass tokenIn/tokenOut/amountIn for a trade-specific read, or no args for a general peg/price snapshot. Read-only.",
    input_schema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", description: "Symbol (optional)." },
        tokenOut: { type: "string", description: "Symbol (optional)." },
        amountIn: { type: "string", description: "Decimal amount of tokenIn (optional)." },
      },
    },
  },
];

function asTokenSymbol(s: unknown): TokenSymbol | undefined {
  return typeof s === "string" && (TOKEN_SYMBOLS as string[]).includes(s)
    ? (s as TokenSymbol)
    : undefined;
}

/** Execute one read-only tool call. Throws surface to the caller as tool errors. */
async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_market_data": {
      const parsed = topicSchema.safeParse(input["topic"]);
      if (!parsed.success) throw new Error(`Unknown topic. Supported: ${TOPICS.join(", ")}`);
      const symbol = typeof input["symbol"] === "string" ? input["symbol"] : undefined;
      return await runAnalyze(parsed.data, symbol);
    }
    case "get_signals": {
      const tokenIn = asTokenSymbol(input["tokenIn"]);
      const tokenOut = asTokenSymbol(input["tokenOut"]);
      return await getTradeSignals({
        ...(tokenIn ? { tokenIn } : {}),
        ...(tokenOut ? { tokenOut } : {}),
        ...(typeof input["amountIn"] === "string" ? { amountIn: input["amountIn"] } : {}),
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export interface ResearchHistoryTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * Run one research turn, streaming `AgentChatEvent`s. `history` is the prior
 * conversation (plain text turns) the client replays for context — there's no
 * server-side persistence.
 */
export async function* runResearchChat(params: {
  message: string;
  history?: ResearchHistoryTurn[];
}): AsyncGenerator<AgentChatEvent> {
  const client = getAnthropic();

  const messages: Anthropic.MessageParam[] = [
    ...(params.history ?? []).map(
      (t): Anthropic.MessageParam => ({ role: t.role, content: t.text }),
    ),
    { role: "user", content: params.message },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });

    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
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
        const data = await executeTool(tu.name, args);
        yield { type: "tool_result", id: tu.id, tool: tu.name, ok: true, data };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(data),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        yield { type: "tool_result", id: tu.id, tool: tu.name, ok: false, error: errMsg };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify({ error: errMsg }),
          is_error: true,
        });
        logger.warn({ err, tool: tu.name }, "research tool execution failed");
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  yield { type: "done" };
}
