import type { RequestHandler } from "express";

/**
 * P5-011 — admin gate for endpoints that prepare ComplianceRegistry
 * (and similar privileged-contract) calldata.
 *
 * Source of truth: `MANTUA_ADMIN_WALLETS` env var, comma-separated
 * lower-case wallet addresses. The on-chain ComplianceRegistry has
 * its own `onlyOperator` modifier — this middleware is a server-side
 * UX guard so non-operator users get a clean 403 instead of a wasted
 * gas attempt that reverts.
 *
 * If `MANTUA_ADMIN_WALLETS` is unset, every request is rejected with
 * 503 "admin endpoints not configured" — no implicit fallback.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const raw = process.env.MANTUA_ADMIN_WALLETS;
  if (!raw || raw.trim().length === 0) {
    res
      .status(503)
      .json({ error: "Admin endpoints not configured.", code: "ADMIN_NOT_CONFIGURED" });
    return;
  }
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
  const wallet = req.walletAddress?.toLowerCase();
  if (!wallet || !allowed.has(wallet)) {
    res.status(403).json({ error: "Admin role required.", code: "FORBIDDEN" });
    return;
  }
  next();
};
