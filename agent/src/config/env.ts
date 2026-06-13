/**
 * Environment loader + validation for the Arc agent. Every contract
 * address and the signing key are loaded from env — never hardcoded.
 * Verified default values + their sources live in .env.example and
 * docs/architecture.md. Call loadEnv() from the composition root only;
 * action providers receive their dependencies as parameters so they stay
 * env-free and testable.
 */
import { z } from "zod";

const hexAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 20-byte 0x address");

const schema = z.object({
  ARC_RPC_URL: z.string().url().default("https://rpc.testnet.arc.network"),
  /** Signing key for the agent's Arc wallet (gas paid in native USDC). */
  AGENT_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x 32-byte private key"),

  // ERC-8004 registries (Arc testnet proxy addresses).
  IDENTITY_REGISTRY_ADDRESS: hexAddress,
  REPUTATION_REGISTRY_ADDRESS: hexAddress,
  VALIDATION_REGISTRY_ADDRESS: hexAddress,
  // ERC-8183 job/escrow contract.
  AGENTIC_COMMERCE_ADDRESS: hexAddress,

  // Allowlisted assets (USDC/EURC/cirBTC) ERC-20 addresses.
  USDC_ADDRESS: hexAddress,
  EURC_ADDRESS: hexAddress,
  CIRBTC_ADDRESS: hexAddress,

  /** Warn when the agent's USDC gas balance (ERC-20, 6dp) drops below this. */
  LOW_GAS_WARN_USDC: z.coerce.number().positive().default(1),
});

export type AgentEnv = z.infer<typeof schema>;

export function loadEnv(): AgentEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid agent environment:\n${issues}\nSee agent/.env.example.`);
  }
  return parsed.data;
}
