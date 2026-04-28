/**
 * Hard-coded safety constants. Lifting any of these requires a code change
 * and redeploy — no runtime / admin path can exceed them.
 */

/**
 * Phase 5b: testnet beta gate. `MANTUA_NETWORK=testnet` (default) targets
 * Base Sepolia (84532); `MANTUA_NETWORK=mainnet` targets Base Mainnet
 * (8453). One env var, multiple downstream effects (chain IDs, v4 contract
 * addresses, token registry, spending-cap default — see PR #2).
 */
export const NETWORK = process.env.MANTUA_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const IS_MAINNET = NETWORK === "mainnet";
export const IS_TESTNET = NETWORK === "testnet";

export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const BASE_CHAIN_ID: number = IS_MAINNET ? BASE_MAINNET_CHAIN_ID : BASE_SEPOLIA_CHAIN_ID;

// Spending caps — USD equivalent.
// (D-009 ACCEPTED: $500 default, tiered raise by account age, $50k absolute ceiling.)
export const DEFAULT_DAILY_CAP_USD = 500;
export const HARD_DAILY_CAP_USD = 50_000;
export const DEFAULT_AGENT_DAILY_CAP_USD = 100;

// Tier thresholds in days since first connection.
export const TIER_RAISE_DAYS = {
  earlyMax: 30, //  0–30:  capped at $500, user can lower only
  midMax: 90, // 31–90:  user can raise to $10k with double-confirmation
} as const;

export const TIER_CAPS_USD = {
  early: 500,
  mid: 10_000,
  full: 50_000,
} as const;

// Slippage (bps).
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
export const WARNING_SLIPPAGE_BPS = 100; // 1.0% — show warning
export const DOUBLE_CONFIRM_SLIPPAGE_BPS = 100; // 1–5% — double-confirm
export const MAX_SLIPPAGE_BPS = 500; // 5.0% — hard reject above

// Mantua fee (bps). D-010 ACCEPTED: 10 default, MAX_FEE_BPS=25.
export const DEFAULT_FEE_BPS = 10;
export const MAX_FEE_BPS = 25;
