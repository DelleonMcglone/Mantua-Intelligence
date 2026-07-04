import Anthropic from "@anthropic-ai/sdk";
import { asc, eq } from "drizzle-orm";
import { isAddress, formatUnits, parseAbi, parseUnits } from "viem";
import { env } from "../env.ts";
import { db } from "../db/client.ts";
import { chatMessages, chatSessions } from "../db/schema/chat.ts";
import { users } from "../db/schema/users.ts";
import { logger } from "./logger.ts";
import { TOKEN_SYMBOLS, getToken, type TokenSymbol } from "./tokens.ts";
import { getOrCreateAgentWallet, getAgentWallet, updateAgentWalletCap } from "./agent-wallet.ts";
import { sendFromAgentWallet } from "./agent-send.ts";
import { swapFromAgentWallet, quoteAgentSwap } from "./agent-swap.ts";
import {
  addLiquidityFromAgentWallet,
  removeLiquidityFromAgentWallet,
  listAgentPositions,
  createPoolFromAgentWallet,
} from "./agent-liquidity.ts";
import { fundAgentWallet } from "./agent-fund.ts";
import { bridgeFromAgentWallet } from "./agent-bridge.ts";
import { getUserPortfolio } from "./user-portfolio.ts";
import { baseRpcClient } from "./rpc-client.ts";
import { getAgentPortfolio } from "./agent-portfolio.ts";
import { isFeeTier, type FeeTier } from "./v4-contracts.ts";
import { getTradeSignals, SIGNAL_THRESHOLDS } from "./agent-signals.ts";
import { runAnalyze, topicSchema } from "./analyze.ts";
import { isX402Available, searchServices, callPaidService } from "./x402-cli.ts";
import {
  getAddressInfo,
  getAddressTransactions,
  getAddressTokenTransfers,
  getTokenInfo,
  getTokenHolders,
  getTransactionInfo,
  summarizeWhaleSignals,
  isEvmAddress,
  isTxHash,
} from "./arcscan.ts";

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
export function getAnthropic(): Anthropic {
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
- Plain text only — do NOT use Markdown: no **bold**, no headings, no backticks, and no "- " or "* " bullet lists. Write naturally in sentences. When you mention a link, write the full URL (e.g. https://faucet.circle.com) so the UI can make it clickable.

Capabilities: manage the agent wallet (view info, set the daily cap), fund the wallet, swap tokens, send tokens, bridge USDC to other chains, create pools and add/remove liquidity, fetch market/on-chain data, do research, make x402 micropayments for premium data, read both the agent's portfolio AND the user's own connected wallet (get_user_wallet), and perform on-chain analysis of any Arc address, token, or transaction via Arcscan (inspect_address / inspect_token / inspect_transaction).

Liquidity: you can create pools and add/remove liquidity, but ONLY no-hook pools and ONLY with the Arc tokens (${TOKEN_SYMBOLS.join(", ")}) — never a hooked pool. To add, call add_liquidity with the pair, both amounts, and a fee tier (default 0.30% / fee 3000 if unspecified). If it fails because the pool doesn't exist, call create_pool for the pair+tier (initializes at the live market price), then add_liquidity again. To remove, FIRST call get_positions to get the position's id, then call remove_liquidity with that id and a percentage (1–100). Execute autonomously and report the amounts; the UI shows the tx link.

Bridging: you can bridge the agent wallet's USDC to another chain via Circle CCTP (bridge tool). Destinations: base, ethereum, arbitrum, unichain, avalanche, optimism, polygon, linea, sonic, world chain, sei, hyperevm (all testnets). Funds land at the USER's connected wallet on the destination unless they give an explicit 0x recipient — mention where the funds will land, and note Circle's forwarding fee is deducted from the minted amount.

Decision logic — ground every action in real signals, never assumptions:
- Before a swap, call get_signals (with tokenIn/tokenOut/amountIn) to read the live peg deviations, spot prices, and the quote-implied price impact. State the relevant numbers and your reasoning in your reply ("EURC 0.03% off peg, impact 0.1% → executing").
- Swaps are guarded in code (MODERATE thresholds): a swap that would ACQUIRE a stablecoin more than ${String(SIGNAL_THRESHOLDS.maxPegDeviationPct)}% off peg, or with price impact over ${String(SIGNAL_THRESHOLDS.maxPriceImpactPct)}%, is BLOCKED and the swap tool returns the reason. Relay that reason plainly and do NOT retry blindly.
- Only if the user explicitly insists on proceeding after you've explained the risk, retry the swap with force=true. Never set force on your own initiative.
- For data / research questions ("look up", "research", prices, volumes, peg, pools), answer from get_market_data / get_signals — cite the figures, don't guess.
- Paid services (x402 — Circle's agent marketplace): you have access to the FULL marketplace at agents.circle.com/services, not just data feeds — web search, news, weather, sports stats, prediction-market odds, social/twitter lookups, academic papers, SMS and other communication APIs, domain lookups, and more. Stablecoin pay-per-use means no API keys and no accounts — you pay a small pre-capped USDC fee per call. BEFORE declining a request because you "can't do that" or lack live data, search_paid_services with a relevant keyword; if a service fits, call_paid_service and use its response. For pure market data still prefer the free tools first. Always state the cost you paid. If a paid call fails, retry once, then search for an alternative provider; if the tools report paid services unavailable in this environment, say so plainly and do your best with built-in tools.

Analyst method — you are a crypto research analyst on Arc (Circle's chain), and Arcscan (testnet.arcscan.app) is your blockchain explorer:
- Daily briefing: when the user asks for a briefing, "what happened", or a market check, run the workflow: (1) market pulse — get_market_data with market-summary and top-stablecoins; (2) peg check — get_signals for USDC/EURC deviations; (3) portfolio review — get_portfolio and get_user_wallet; (4) anything notable on-chain. Deliver a concise analyst brief: figures first, then interpretation, then recommended actions.
- On-chain analysis: use inspect_address for any wallet (balance, activity, whale signals), inspect_token for tokenomics + holder concentration, inspect_transaction to decode what a tx did. Whale signals to look for: accumulating a token, selling a held token, using a new protocol, rotating stables into tokens (risk-on) or tokens into stables (risk-off). NEVER suggest blindly copying a wallet — treat its activity as a hypothesis, then verify with your own data (pegs, price impact, volumes) before recommending anything.
- Token safety: before recommending any token, check inspect_token and call out red flags explicitly — top-10 holder concentration, a tiny holder base, or supply parked in a few contracts. Exchange/pool contracts among top holders are normal; unlabeled EOA whales are the ones to scrutinize.
- Research principles: primary sources beat summaries; cite concrete figures, never vibes; free data first, x402 paid data when free is insufficient; include the Arcscan link when discussing an address, token, or tx so the user can verify.

Funding: when the user wants to fund the agent wallet, FIRST try fund_wallet (Circle's programmatic testnet faucet). If it reports requested=false, relay the manual path: give the agent address and tell them to request testnet USDC at faucet.circle.com (choose Arc Testnet), or transfer from their own wallet; balances refresh automatically once it lands.

Analyst advisor — when you can't execute but the user could: if a swap, add_liquidity, or bridge fails with "Insufficient agent balance" or a spending-cap error, do NOT stop at the error. (1) State the shortfall plainly (needed vs available). (2) Call get_user_wallet to read the USER's own balances. (3) If the user holds enough, deliver your analysis (the signals/peg/impact data you already fetched) and a concrete recommendation: tell them you recommend executing it themselves via the app's Swap / Add Liquidity / Bridge panel, with the exact amounts and reasoning ("you hold 250 USDC; EURC is 0.03% off peg with 0.1% impact — I'd proceed"). (4) If they don't hold enough either, say so and suggest funding options. Always ground the recommendation in real signals, never assumptions.

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
    name: "get_signals",
    description:
      "Read the real-time decision signals for a potential trade: peg deviations (USDC/EURC), spot prices, and the live quote-implied price impact. Pass tokenIn/tokenOut/amountIn for a trade-specific read, or no args for a general peg/price snapshot. Read-only. Call this before swapping.",
    input_schema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", description: "Symbol to swap from (optional)." },
        tokenOut: { type: "string", description: "Symbol to swap into (optional)." },
        amountIn: { type: "string", description: "Decimal amount of tokenIn (optional)." },
      },
    },
  },
  {
    name: "swap",
    description:
      "Execute a token swap from the agent wallet via Uniswap on Arc. Input is denominated in tokenIn. Executes immediately, but is BLOCKED if the live signals breach the safety thresholds (peg / price impact) unless force=true.",
    input_schema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", description: "Symbol to swap from." },
        tokenOut: { type: "string", description: "Symbol to swap into." },
        amountIn: { type: "string", description: "Decimal amount of tokenIn." },
        force: {
          type: "boolean",
          description:
            "Override the safety guard. Only set true after the user has been told the risk and explicitly insists.",
        },
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
  {
    name: "get_positions",
    description:
      "List the agent wallet's open liquidity positions (id, token pair, fee tier, liquidity). Call this before remove_liquidity to get the position id. Read-only.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_liquidity",
    description:
      "Add liquidity to a NO-HOOK pool from the agent wallet, using only Arc tokens (USDC/EURC/cirBTC). Executes immediately (gas-sponsored). Fails if no no-hook pool exists at the fee tier.",
    input_schema: {
      type: "object",
      properties: {
        tokenA: { type: "string", description: "First token symbol (USDC/EURC/cirBTC)." },
        tokenB: { type: "string", description: "Second token symbol (must differ from tokenA)." },
        amountA: { type: "string", description: "Decimal amount of tokenA (human units)." },
        amountB: { type: "string", description: "Decimal amount of tokenB (human units)." },
        fee: {
          type: "number",
          description: "Fee tier in pips: 100, 500, 3000, or 10000. Defaults to 3000 (0.30%).",
        },
      },
      required: ["tokenA", "tokenB", "amountA", "amountB"],
    },
  },
  {
    name: "remove_liquidity",
    description:
      "Remove a percentage of liquidity from one of the agent's positions. Get the positionId from get_positions first. Executes immediately.",
    input_schema: {
      type: "object",
      properties: {
        positionId: { type: "string", description: "Position id from get_positions." },
        percentage: {
          type: "number",
          description: "Percent of the position to remove, 1–100 (100 = full exit).",
        },
      },
      required: ["positionId", "percentage"],
    },
  },
  {
    name: "search_paid_services",
    description:
      "Search Circle's x402 agent marketplace (agents.circle.com/services) by keyword — the FULL catalog, not just data: web search, news, weather, sports stats, prediction-market odds, twitter/social, academic papers, SMS/communication APIs, domain lookups, and more. Returns candidate services with their per-call USDC price and accepted chains. BEFORE saying you can't do something, search here — a paid service may cover it. Read-only; no payment. May be unavailable in this environment.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "What to search for (1–100 chars)." },
      },
      required: ["keyword"],
    },
  },
  {
    name: "call_paid_service",
    description:
      "Pay a small USDC fee (pre-capped) to call ANY x402 marketplace service URL from search_paid_services — data lookups, web search, notifications, whatever the service does — and return its response. Handles inspect + payment automatically. State the USD cost you paid in your reply. May be unavailable in this environment (then say so and use built-in tools where possible).",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The service URL from search_paid_services." },
        data: {
          type: "object",
          description: "Optional request payload (object) matching the service's schema.",
        },
        chain: {
          type: "string",
          description: "Optional CLI chain code to pay from (e.g. BASE, MATIC). Defaults sensibly.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "fund_wallet",
    description:
      "Request testnet USDC for the agent wallet from Circle's programmatic faucet. If the request isn't available, the result includes the agent address and manual faucet instructions to relay to the user.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_user_wallet",
    description:
      "Read the USER's connected wallet balances (USDC/EURC/cirBTC + USD values) — distinct from the agent's own wallet. Use when advising whether the user should execute a transaction themselves (e.g. after an insufficient-agent-balance or spending-cap error). Read-only.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "bridge",
    description:
      "Bridge USDC from the agent wallet on Arc to another chain via Circle CCTP. Destination accepts a chain name or alias (base, ethereum, arbitrum, unichain, avalanche, optimism, polygon, linea, sonic, world chain, sei, hyperevm). Funds land at the USER's connected wallet on the destination unless an explicit 0x recipient is given. Executes immediately (~10-60s).",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "string", description: "Decimal USDC amount, e.g. \"1.5\"." },
        destinationChain: { type: "string", description: "Destination chain name or alias." },
        recipient: {
          type: "string",
          description: "Optional 0x recipient on the destination. Defaults to the user's wallet.",
        },
      },
      required: ["amount", "destinationChain"],
    },
  },
  {
    name: "create_pool",
    description:
      "Initialize a NO-HOOK v4 pool for an Arc token pair at the live market price (Pyth). Use when add_liquidity reports the pool doesn't exist, then add liquidity. Executes immediately.",
    input_schema: {
      type: "object",
      properties: {
        tokenA: { type: "string", description: "First token symbol (USDC/EURC/cirBTC)." },
        tokenB: { type: "string", description: "Second token symbol (must differ)." },
        fee: {
          type: "number",
          description: "Fee tier in pips: 100, 500, 3000, or 10000. Defaults to 3000.",
        },
      },
      required: ["tokenA", "tokenB"],
    },
  },
  {
    name: "inspect_address",
    description:
      "On-chain analysis of ANY address on Arc via Arcscan: native balance, contract/EOA, recent transactions + token transfers, and computed whale signals (accumulating/selling per token, stables↔tokens rotation). Use for whale-watching, checking a counterparty, or reviewing a wallet's activity. Read-only.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "0x address to inspect." },
      },
      required: ["address"],
    },
  },
  {
    name: "inspect_token",
    description:
      "Tokenomics + holder analysis for a token on Arc via Arcscan: supply, holder count, top holders with % of supply, top-10 concentration, and safety red flags (heavy concentration, tiny holder count). Accepts an Arc symbol (USDC/EURC/cirBTC) or any 0x token address. Read-only.",
    input_schema: {
      type: "object",
      properties: {
        addressOrSymbol: {
          type: "string",
          description: "Token symbol (USDC/EURC/cirBTC) or 0x token address.",
        },
      },
      required: ["addressOrSymbol"],
    },
  },
  {
    name: "inspect_transaction",
    description:
      "Decode what an Arc transaction actually did: status, method, from/to, and every token movement inside it. Use when the user pastes a tx hash or you need to verify an on-chain action. Read-only.",
    input_schema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "0x transaction hash (66 chars)." },
      },
      required: ["hash"],
    },
  },
];

interface ToolInput {
  [k: string]: unknown;
}

function isTokenSymbol(s: unknown): s is TokenSymbol {
  return typeof s === "string" && (TOKEN_SYMBOLS as string[]).includes(s);
}

const BALANCE_ABI = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

/**
 * Pre-flight agent-balance check for write tools. Throws a structured
 * "Insufficient agent balance" message (instead of an opaque on-chain revert)
 * so the model can pivot to the analyst-advisor flow: check the user's wallet
 * and recommend they execute the trade themselves if they hold enough.
 */
async function requireAgentBalance(
  privyUserId: string,
  symbol: TokenSymbol,
  amount: string,
): Promise<void> {
  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) return; // provisioning errors surface from the tool itself
  const t = getToken(symbol);
  let needed: bigint;
  try {
    needed = parseUnits(amount, t.decimals);
  } catch {
    return; // malformed amounts fail in the tool's own validation
  }
  const owner = wallet.address as `0x${string}`;
  const have = t.native
    ? await baseRpcClient.getBalance({ address: owner })
    : await baseRpcClient.readContract({
        address: t.address,
        abi: BALANCE_ABI,
        functionName: "balanceOf",
        args: [owner],
      });
  if (have < needed) {
    throw new Error(
      `Insufficient agent balance: needs ${amount} ${symbol}, has ${formatUnits(have, t.decimals)} ${symbol}.`,
    );
  }
}

/** Execute one tool call. Throws are caught by the caller and surfaced as tool errors. */
async function executeTool(
  privyUserId: string,
  userWalletAddress: string | undefined,
  name: string,
  input: ToolInput,
): Promise<unknown> {
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
    case "get_signals": {
      const { tokenIn, tokenOut, amountIn } = input;
      return await getTradeSignals({
        ...(isTokenSymbol(tokenIn) ? { tokenIn } : {}),
        ...(isTokenSymbol(tokenOut) ? { tokenOut } : {}),
        ...(typeof amountIn === "string" ? { amountIn } : {}),
      });
    }
    case "swap": {
      const { tokenIn, tokenOut, amountIn, force } = input;
      if (!isTokenSymbol(tokenIn) || !isTokenSymbol(tokenOut)) {
        throw new Error(`tokens must be one of: ${TOKEN_SYMBOLS.join(", ")}`);
      }
      // Decision guardrail: hold the swap if live signals breach the safety
      // thresholds, unless the caller explicitly forces it. Signal-feed
      // failures don't block (verdict stays ok when data is missing).
      if (force !== true) {
        let verdict: { ok: boolean; reasons: string[] } | null = null;
        try {
          ({ verdict } = await getTradeSignals({
            tokenIn,
            tokenOut,
            amountIn: String(amountIn),
          }));
        } catch (err) {
          logger.warn({ err, tokenIn, tokenOut }, "agent swap signal check failed; proceeding");
        }
        if (verdict && !verdict.ok) {
          throw new Error(`Swap held by the safety guard — ${verdict.reasons.join("; ")}.`);
        }
      }
      await requireAgentBalance(privyUserId, tokenIn, String(amountIn));
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
      await requireAgentBalance(privyUserId, token, String(amount));
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
    case "get_positions": {
      const list = await listAgentPositions(privyUserId);
      return {
        positions: list.map((p) => ({
          id: p.id,
          pair: `${p.tokenA}/${p.tokenB}`,
          fee: p.fee,
          hasHook: p.hasHook,
          liquidity: p.liquidity,
        })),
      };
    }
    case "add_liquidity": {
      const { tokenA, tokenB, amountA, amountB } = input;
      if (!isTokenSymbol(tokenA) || !isTokenSymbol(tokenB)) {
        throw new Error(`Both tokens must be Arc symbols: ${TOKEN_SYMBOLS.join(", ")}.`);
      }
      if (typeof amountA !== "string" || typeof amountB !== "string") {
        throw new Error("amountA and amountB are required decimal strings.");
      }
      const feeRaw = typeof input["fee"] === "number" ? input["fee"] : 3000;
      if (!isFeeTier(feeRaw)) throw new Error("fee must be one of 100, 500, 3000, 10000.");
      const fee: FeeTier = feeRaw;
      await requireAgentBalance(privyUserId, tokenA, amountA);
      await requireAgentBalance(privyUserId, tokenB, amountB);
      return await addLiquidityFromAgentWallet({
        privyUserId,
        tokenA,
        tokenB,
        fee,
        hook: null, // no hooks — agent only manages no-hook pools
        amountA,
        amountB,
        slippageBps: 50,
        deadlineSeconds: Math.floor(Date.now() / 1000) + 1800,
      });
    }
    case "remove_liquidity": {
      const positionId = input["positionId"];
      const percentage = input["percentage"];
      if (typeof positionId !== "string") throw new Error("positionId (string) is required.");
      if (typeof percentage !== "number" || percentage < 1 || percentage > 100) {
        throw new Error("percentage must be a number from 1 to 100.");
      }
      return await removeLiquidityFromAgentWallet({
        privyUserId,
        positionId,
        percentage,
        slippageBps: 50,
        deadlineSeconds: Math.floor(Date.now() / 1000) + 1800,
      });
    }
    case "search_paid_services": {
      if (!(await isX402Available())) {
        return {
          available: false,
          note: "Paid services are unavailable in this environment. Use free data (get_market_data).",
        };
      }
      const services = await searchServices(input["keyword"]);
      return { available: true, services };
    }
    case "call_paid_service": {
      if (!(await isX402Available())) {
        return {
          available: false,
          note: "Paid services are unavailable in this environment. Use free data (get_market_data).",
        };
      }
      const data = input["data"] && typeof input["data"] === "object" ? input["data"] : undefined;
      const result = await callPaidService({ url: input["url"], data, chain: input["chain"] });
      return { available: true, ...result };
    }
    case "fund_wallet": {
      const w = await getAgentWallet(privyUserId);
      if (!w) throw new Error("No agent wallet provisioned.");
      try {
        const r = await fundAgentWallet(privyUserId);
        return { requested: true, agentAddress: r.agentAddress, network: r.blockchain };
      } catch {
        return {
          requested: false,
          agentAddress: w.address,
          faucet: "https://faucet.circle.com",
          note: "Programmatic faucet unavailable. Ask the user to request testnet USDC/EURC at faucet.circle.com (choose Arc Testnet) for the agent address, or transfer from their own wallet.",
        };
      }
    }
    case "get_user_wallet": {
      if (!userWalletAddress) {
        return { connected: false, note: "No user wallet is connected in this session." };
      }
      const p = await getUserPortfolio(privyUserId, userWalletAddress);
      return {
        connected: true,
        address: userWalletAddress,
        balances: p.balances.map((b) => ({
          symbol: b.symbol,
          balance: formatUnits(BigInt(b.balanceRaw), b.decimals),
          usdValue: b.usdValue,
        })),
      };
    }
    case "bridge": {
      const amountIn = input["amount"];
      const destIn = input["destinationChain"];
      if (typeof amountIn !== "string" || typeof destIn !== "string") {
        throw new Error("amount and destinationChain must be strings.");
      }
      const amount = amountIn;
      const destinationChain = destIn;
      const explicit = input["recipient"];
      let recipient: `0x${string}`;
      if (typeof explicit === "string" && explicit.length > 0) {
        if (!isAddress(explicit)) throw new Error("recipient must be a valid 0x EVM address.");
        recipient = explicit;
      } else if (userWalletAddress && isAddress(userWalletAddress)) {
        recipient = userWalletAddress;
      } else {
        throw new Error(
          "No recipient available: the user has no connected wallet — ask for an explicit 0x recipient address on the destination chain.",
        );
      }
      await requireAgentBalance(privyUserId, "USDC", amount);
      const r = await bridgeFromAgentWallet({ privyUserId, amount, destinationChain, recipient });
      return r;
    }
    case "create_pool": {
      const { tokenA, tokenB } = input;
      if (!isTokenSymbol(tokenA) || !isTokenSymbol(tokenB)) {
        throw new Error(`Both tokens must be Arc symbols: ${TOKEN_SYMBOLS.join(", ")}.`);
      }
      const feeRaw = typeof input["fee"] === "number" ? input["fee"] : 3000;
      if (!isFeeTier(feeRaw)) throw new Error("fee must be one of 100, 500, 3000, 10000.");
      return await createPoolFromAgentWallet({ privyUserId, tokenA, tokenB, fee: feeRaw });
    }
    case "inspect_address": {
      const address = input["address"];
      if (typeof address !== "string" || !isEvmAddress(address)) {
        throw new Error("address must be a valid 0x EVM address.");
      }
      const [info, txs, transfers] = await Promise.all([
        getAddressInfo(address),
        getAddressTransactions(address, 8),
        getAddressTokenTransfers(address, 15),
      ]);
      if (!info) {
        return { found: false, note: "Arcscan has no data for this address (or is unreachable)." };
      }
      return {
        found: true,
        ...info,
        recentTransactions: txs,
        tokenTransfers: transfers,
        signals: summarizeWhaleSignals(transfers),
      };
    }
    case "inspect_token": {
      const raw = input["addressOrSymbol"];
      if (typeof raw !== "string" || raw.length === 0) {
        throw new Error("addressOrSymbol is required.");
      }
      const address = isTokenSymbol(raw) ? getToken(raw).address : raw;
      if (!isEvmAddress(address)) {
        throw new Error("Provide an Arc token symbol (USDC/EURC/cirBTC) or a 0x token address.");
      }
      const [info, holders] = await Promise.all([getTokenInfo(address), getTokenHolders(address)]);
      if (!info) {
        return { found: false, note: "Arcscan has no token data for this address." };
      }
      const flags: string[] = [];
      if (holders.top10Pct > 50) {
        flags.push(
          `Heavy concentration: top 10 holders control ${holders.top10Pct.toFixed(1)}% of supply.`,
        );
      }
      if (info.holdersCount > 0 && info.holdersCount < 100) {
        flags.push(`Very small holder base (${String(info.holdersCount)} holders).`);
      }
      return { found: true, ...info, ...holders, flags };
    }
    case "inspect_transaction": {
      const hash = input["hash"];
      if (typeof hash !== "string" || !isTxHash(hash)) {
        throw new Error("hash must be a 0x transaction hash (66 chars).");
      }
      const tx = await getTransactionInfo(hash);
      if (!tx) return { found: false, note: "Arcscan has no data for this transaction." };
      return { found: true, ...tx };
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
        const data = await executeTool(privyUserId, walletAddress, tu.name, args);
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
