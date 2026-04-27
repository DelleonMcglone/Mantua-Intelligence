import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),

  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),

  UNISWAP_TRADING_API_KEY: z.string().min(1).optional(),

  /** Base mainnet RPC URL — used by server-side viem readContract calls
   *  (StateView.getSlot0, etc.). Defaults to the public endpoint; supply
   *  Alchemy/QuickNode in production for headroom. */
  BASE_RPC_URL: z.url().default("https://mainnet.base.org"),

  /** The Graph decentralized-network API key. Required for /api/positions
   *  to surface pre-Mantua v4 positions; absence degrades gracefully (only
   *  Mantua-opened positions are returned). */
  THE_GRAPH_API_KEY: z.string().min(1).optional(),
  UNISWAP_V4_BASE_SUBGRAPH_ID: z
    .string()
    .min(1)
    .default("HNCFA9TyBqpo5qpe6QreQABAA1kV8g46mhkCcicu6v2R"),

  CDP_PROJECT_ID: z.string().min(1).optional(),
  CDP_API_KEY_NAME: z.string().min(1).optional(),
  CDP_API_KEY_PRIVATE_KEY: z.string().min(1).optional(),
  CDP_WALLET_SECRET: z.string().min(1).optional(),

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
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(z.treeifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
