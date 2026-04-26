/**
 * Phase 3 — client-side mirror of the slippage hard ceiling. Server is
 * the canonical enforcement (`server/src/lib/constants.ts`); this is a
 * UX guardrail to prevent the user from typing 600 bps and immediately
 * getting rejected.
 */
export const DEFAULT_SLIPPAGE_BPS = 50;
export const MAX_SLIPPAGE_BPS = 500;
export const BASE_SCAN_TX = "https://basescan.org/tx/";
