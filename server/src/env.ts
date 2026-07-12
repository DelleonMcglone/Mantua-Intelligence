import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),

  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),

  UNISWAP_TRADING_API_KEY: z.string().min(1).optional(),

  /** Network gate. Mantua runs on Arc Testnet only, so this stays
   *  `testnet`; the `mainnet` option is retained for the shared
   *  IS_MAINNET guard but there is no Arc mainnet to target. */
  MANTUA_NETWORK: z.enum(["mainnet", "testnet"]).default("testnet"),

  /** Arc Testnet RPC URL — used by all server-side viem reads
   *  (StateView.getSlot0, portfolio balances, etc.). Override with a
   *  private endpoint (Alchemy/QuickNode) in production for headroom. */
  ARC_RPC_URL: z.url().default("https://rpc.testnet.arc.network"),

  /** The Graph decentralized-network API key. Required for /api/positions
   *  to surface pre-Mantua v4 positions; absence degrades gracefully (only
   *  Mantua-opened positions are returned). */
  THE_GRAPH_API_KEY: z.string().min(1).optional(),
  UNISWAP_V4_BASE_SUBGRAPH_ID: z
    .string()
    .min(1)
    .default("HNCFA9TyBqpo5qpe6QreQABAA1kV8g46mhkCcicu6v2R"),

  // Circle Developer-Controlled Wallets — the agent-wallet provider on Arc.
  // CIRCLE_API_KEY: a Standard key from the Circle Developer Console.
  // CIRCLE_ENTITY_SECRET: your registered 32-byte entity secret (hex).
  // CIRCLE_WALLET_SET_ID: the wallet set agent wallets are created in — set
  //   this after the first one is created (it's logged on creation) so we
  //   don't spin up a new wallet set on each cold start.
  CIRCLE_API_KEY: z.string().min(1).optional(),
  CIRCLE_ENTITY_SECRET: z.string().min(1).optional(),
  CIRCLE_WALLET_SET_ID: z.string().min(1).optional(),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),

  MANTUA_KILL_SWITCH: z
    .union([z.literal("0"), z.literal("1")])
    .default("0")
    .transform((v) => v === "1"),
  MANTUA_FEE_BPS: z.coerce.number().int().min(0).max(25).default(10),
  MANTUA_FEE_RECIPIENT: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  MANTUA_FEE_ADMIN_KEY: z.string().min(1).optional(),

  /** Shared secret guarding the auto-rebalance cron endpoint. Vercel Cron sends
   *  it as `Authorization: Bearer <CRON_SECRET>`; an external scheduler can use
   *  the same header. Absent → the endpoint is disabled (503). */
  CRON_SECRET: z.string().min(1).optional(),

  /** x402 nanopayments — the agent pays small USDC fees per call to the x402
   *  agent marketplace over plain HTTP (v2 protocol; settles on Base Sepolia
   *  via the public facilitator, no CLI and no gas needed). Off by default;
   *  when off (or no buyer key is configured) the agent falls back to free
   *  data. See docs/x402-setup.md. */
  X402_ENABLED: z
    .union([z.literal("0"), z.literal("1")])
    .default("0")
    .transform((v) => v === "1"),
  /** Buyer EOA private key that signs x402 payment authorizations (needs
   *  Base Sepolia USDC, no gas). Falls back to MANTUA_ADMIN_PRIVATE_KEY —
   *  the same EOA the x402 SELLER is paid to. */
  X402_BUYER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  /** Per-call hard ceiling in USDC. */
  X402_MAX_CALL_USD: z.coerce.number().positive().default(0.1),
  /** Daily x402 spend ceiling in USDC (summed from the audit log). */
  X402_DAILY_CAP_USD: z.coerce.number().positive().default(1),

  /** Pyth Hermes base URL — primary off-chain price source (DefiLlama is the
   *  fallback). Override to point at a self-hosted Hermes; feature is always-on
   *  with graceful fallback, so no separate enable flag. */
  PYTH_HERMES_URL: z.url().default("https://hermes.pyth.network"),

  /** x402 SELLER: address that receives USDC (Base Sepolia) when other agents
   *  pay for Mantua's analyst brief at /api/x402/analyst-brief. Absent → the
   *  seller endpoint is disabled (503). */
  X402_SELLER_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),

  /** ERC-8183 AgenticCommerce job/escrow contract on Arc Testnet (ERC-1967
   *  proxy; verified via Arcscan — same instance the agent/ package targets,
   *  see agent/.env.example). Agent-to-agent commerce tools (create/fund/
   *  settle jobs with USDC escrow) execute against it from the agent's
   *  Circle wallet. */
  AGENTIC_COMMERCE_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default("0x0747EEf0706327138c69792bF28Cd525089e4583"),

  /** Owner EOA private key for the Stable Protection hook's peg-reference admin.
   *  The peg-sync keeper signs `setPegReference` (EUR/USD) with it. Absent →
   *  the keeper is disabled (503). Moves no user funds; only sets the FX
   *  reference. Fund this address with USDC (Arc gas). */
  MANTUA_ADMIN_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

export type Env = z.infer<typeof schema>;

/**
 * Treat blank `.env` values (`KEY=`) as unset. Zod's `.optional()`
 * accepts `undefined` but not `""`, so a stray empty line failed
 * validation for fields like `MANTUA_FEE_RECIPIENT` and crashed the
 * server on boot.
 */
function blankEnvToUndefined(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    out[key] = typeof value === "string" && value.trim() === "" ? undefined : value;
  }
  return out;
}

export function loadEnv(): Env {
  const parsed = schema.safeParse(blankEnvToUndefined(process.env));
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(z.treeifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
