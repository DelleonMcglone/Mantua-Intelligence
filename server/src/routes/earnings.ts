import { Router, type Request, type Response } from "express";
import { formatUnits } from "viem";
import { logger } from "../lib/logger.ts";
import { DEFAULT_CHAIN_ID } from "../lib/chains.ts";
import { getTokens, type Token } from "../lib/tokens.ts";
import { tokenAmountUsdForToken } from "../lib/usd-pricing.ts";
import { readOnchainPositions } from "../lib/v4-onchain-positions.ts";
import { buildCollectFeesCalldata } from "../lib/v4-remove-liquidity.ts";
import { requireAuth } from "../middleware/auth.ts";

export const earningsRouter = Router();

/** Look up a known token by address (case-insensitive). null if unknown. */
function tokenByAddress(address: string): Token | null {
  const lower = address.toLowerCase();
  const tokens = getTokens(DEFAULT_CHAIN_ID);
  for (const sym of Object.keys(tokens)) {
    if (tokens[sym].address.toLowerCase() === lower) return tokens[sym];
  }
  return null;
}

interface EarningPosition {
  tokenId: string;
  hookAddress: string | null;
  sym0: string;
  sym1: string;
  accrued0: string;
  accrued1: string;
  accrued0Human: number;
  accrued1Human: number;
  accruedUsd: number;
}

/**
 * Real uncollected swap fees across the user's open positions, read live from
 * v4 (feeGrowthInside math). No fabricated figures — positions with no accrued
 * fees report 0. Token amounts are exact; USD is best-effort from price feeds.
 */
earningsRouter.get("/api/earnings", requireAuth, async (req: Request, res: Response) => {
  const wallet = req.walletAddress as `0x${string}` | undefined;
  if (!wallet) {
    res.json({ totalAccruedUsd: 0, positions: [] });
    return;
  }
  try {
    // Source positions on-chain (authoritative; no DB row needed on testnet).
    // Each position already carries its uncollected fees in raw base units.
    const onchain = await readOnchainPositions(wallet);

    const out: EarningPosition[] = [];
    let totalAccruedUsd = 0;
    for (const p of onchain) {
      const t0 = tokenByAddress(p.token0);
      const t1 = tokenByAddress(p.token1);
      const a0 = BigInt(p.fees0);
      const a1 = BigInt(p.fees1);
      const usd0 = t0 ? await tokenAmountUsdForToken(t0, a0) : 0;
      const usd1 = t1 ? await tokenAmountUsdForToken(t1, a1) : 0;
      const accruedUsd = usd0 + usd1;
      totalAccruedUsd += accruedUsd;

      out.push({
        tokenId: p.tokenId,
        hookAddress: p.hookAddress,
        sym0: p.tokenA,
        sym1: p.tokenB,
        accrued0: p.fees0,
        accrued1: p.fees1,
        accrued0Human: t0 ? Number(formatUnits(a0, t0.decimals)) : 0,
        accrued1Human: t1 ? Number(formatUnits(a1, t1.decimals)) : 0,
        accruedUsd,
      });
    }

    res.json({ totalAccruedUsd, positions: out });
  } catch (err) {
    logger.error({ err }, "GET /api/earnings failed");
    res.status(500).json({ error: "Failed to read earnings", code: "EARNINGS_FAILED" });
  }
});

interface SweepTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  tokenId: string;
  pair: string;
}

/**
 * Build the calldata to sweep (collect) accrued swap fees from every open,
 * on-chain position the user owns. One `modifyLiquidities` collect tx per
 * position (each routed to its hook's PositionManager); the client signs +
 * sends them. Returns an empty list when there's nothing to collect.
 */
earningsRouter.post(
  "/api/earnings/sweep/calldata",
  requireAuth,
  async (req: Request, res: Response) => {
    if (!req.privyUserId) {
      res.status(401).json({ error: "Auth required", code: "UNAUTHENTICATED" });
      return;
    }
    const recipient = req.walletAddress as `0x${string}` | undefined;
    if (!recipient) {
      res.status(401).json({ error: "Wallet required", code: "WALLET_REQUIRED" });
      return;
    }
    try {
      // Collect from every open on-chain position (no DB row required).
      const onchain = await readOnchainPositions(recipient);
      const deadlineSeconds = Math.floor(Date.now() / 1000) + 1200;
      const txs: SweepTx[] = [];
      for (const p of onchain) {
        const cd = buildCollectFeesCalldata({
          tokenId: BigInt(p.tokenId),
          currency0: p.token0,
          currency1: p.token1,
          hookAddress: p.hookAddress,
          recipient,
          deadlineSeconds,
        });
        txs.push({ ...cd, tokenId: p.tokenId, pair: `${p.tokenA}/${p.tokenB}` });
      }

      res.json({ txs });
    } catch (err) {
      logger.error({ err }, "POST /api/earnings/sweep/calldata failed");
      res.status(500).json({ error: "Failed to build sweep calldata", code: "SWEEP_FAILED" });
    }
  },
);
