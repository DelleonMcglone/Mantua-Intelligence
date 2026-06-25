import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.ts";
import { getTradeSignals, parseSignalsQuery } from "../lib/agent-signals.ts";
import { walletRateLimiter } from "../middleware/rate-limit.ts";

export const signalsRouter = Router();

/**
 * Public read-only signal snapshot — the same real-signal layer the
 * autonomous agent reads via its internal `get_signals` tool, exposed as a
 * first-class endpoint so the client, dashboards, and external monitors can
 * see the peg deviations, spot prices, quote-implied price impact, and the
 * threshold-based verdict the agent acts on.
 *
 *   GET /api/signals
 *     → USDC/EURC peg snapshot (no trade, verdict ok).
 *   GET /api/signals?tokenIn=USDC&tokenOut=EURC&amountIn=100
 *     → includes the trade signal + verdict for that hypothetical swap.
 *
 * Open route (public data); rate-limited per wallet/IP, mirroring
 * `/api/analyze`. The trade quote hits the live pool, so failures surface as
 * a 502 rather than a misleading "ok" verdict.
 */
signalsRouter.get(
  "/api/signals",
  walletRateLimiter,
  async (req: Request, res: Response) => {
    const parsed = parseSignalsQuery(req.query);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error, code: "BAD_REQUEST" });
      return;
    }
    try {
      const signals = await getTradeSignals(parsed.value);
      res.json(signals);
    } catch (err) {
      logger.warn({ err, query: parsed.value }, "/api/signals failed");
      const message = err instanceof Error ? err.message : "Signals failed";
      res.status(502).json({
        error: `Couldn't read signals right now: ${message}`,
        code: "SIGNALS_UPSTREAM_FAILURE",
      });
    }
  },
);
