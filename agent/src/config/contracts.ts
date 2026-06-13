/**
 * Assembles typed contract config + the asset allowlist from validated
 * env. Single place that turns raw env addresses into the structured
 * config the action providers consume. Token decimals are protocol facts
 * (USDC 6, EURC 6, cirBTC 8); addresses come from env (never hardcoded).
 */
import {
  type Asset,
  type AssetAllowlist,
  type AssetSymbol,
  createAssetAllowlist,
} from "./assets.ts";
import type { AgentEnv } from "./env.ts";

const TOKEN_DECIMALS: Record<AssetSymbol, number> = { USDC: 6, EURC: 6, cirBTC: 8 };

export interface ContractConfig {
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
  validationRegistry: `0x${string}`;
  agenticCommerce: `0x${string}`;
  allowlist: AssetAllowlist;
  /** Convenience handle for the USDC asset (escrow + gas-balance reads). */
  usdc: Asset;
}

export function loadContractConfig(env: AgentEnv): ContractConfig {
  const assets: Asset[] = [
    { symbol: "USDC", address: env.USDC_ADDRESS as `0x${string}`, decimals: TOKEN_DECIMALS.USDC },
    { symbol: "EURC", address: env.EURC_ADDRESS as `0x${string}`, decimals: TOKEN_DECIMALS.EURC },
    {
      symbol: "cirBTC",
      address: env.CIRBTC_ADDRESS as `0x${string}`,
      decimals: TOKEN_DECIMALS.cirBTC,
    },
  ];
  const allowlist = createAssetAllowlist(assets);
  return {
    identityRegistry: env.IDENTITY_REGISTRY_ADDRESS as `0x${string}`,
    reputationRegistry: env.REPUTATION_REGISTRY_ADDRESS as `0x${string}`,
    validationRegistry: env.VALIDATION_REGISTRY_ADDRESS as `0x${string}`,
    agenticCommerce: env.AGENTIC_COMMERCE_ADDRESS as `0x${string}`,
    allowlist,
    usdc: allowlist.requireAllowed("USDC"),
  };
}
