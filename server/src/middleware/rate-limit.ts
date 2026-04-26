import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, RequestHandler } from "express";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const ONE_MIN_MS = 60 * 1000;

/**
 * P1-007 — generic per-IP limiter for any API route. 100 req / 15 min.
 * This is the global ceiling; tighter limiters can be applied to expensive
 * routes (e.g. quote, swap) on top.
 */
export const ipRateLimiter: RequestHandler = rateLimit({
  windowMs: FIFTEEN_MIN_MS,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests from this IP.", code: "RATE_LIMITED" },
});

/**
 * Tighter limiter for write paths that touch the chain (swap, LP, agent).
 * 20 req / minute per IP. Intended to short-circuit obvious abuse before
 * any of the more expensive checks (cap lookup, quote fetch) run.
 */
export const writeRateLimiter: RequestHandler = rateLimit({
  windowMs: ONE_MIN_MS,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many write requests.", code: "RATE_LIMITED" },
});

/**
 * Per-wallet rate limiter. Until Phase 2 wires Privy auth, the wallet is
 * unknown at this layer — so this falls back to per-IP. After Phase 2,
 * `req.walletAddress` will be populated and the limiter will key on that.
 */
export const walletRateLimiter: RequestHandler = rateLimit({
  windowMs: ONE_MIN_MS,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const wallet = (req as Request & { walletAddress?: string }).walletAddress;
    if (wallet) return `wallet:${wallet.toLowerCase()}`;
    return `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  message: { error: "Too many requests for this wallet.", code: "RATE_LIMITED" },
});
