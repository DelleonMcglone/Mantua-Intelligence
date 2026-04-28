import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { logAudit } from "../lib/audit.ts";
import {
  ComplianceRegistryUnavailableError,
  buildAddToWhitelist,
  buildBatchAddToWhitelist,
  buildRemoveFromWhitelist,
} from "../lib/compliance-calldata.ts";
import { logger } from "../lib/logger.ts";
import { getRequestContext } from "../lib/request-context.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";
import { requireAdmin } from "../middleware/require-admin.ts";

export const complianceAdminRouter = Router();

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid address");
const expirySchema = z
  .number()
  .int()
  .nonnegative()
  .max(2 ** 48 - 1, "expiry exceeds uint48 — register stores as uint256 but cap is reasonable");

const addSchema = z.object({
  account: addressSchema,
  expiry: expirySchema.default(0),
});

const batchSchema = z
  .object({
    accounts: z.array(addressSchema).min(1).max(200),
    expiries: z.array(expirySchema).min(1).max(200),
  })
  .refine((d) => d.accounts.length === d.expiries.length, {
    message: "accounts and expiries length mismatch",
  });

const removeSchema = z.object({ account: addressSchema });

const recordSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  action: z.enum(["add", "batch_add", "remove"]),
  accounts: z.array(addressSchema).min(1).max(200),
  outcome: z.enum(["success", "failure"]),
});

function handleError(res: Response, err: unknown, what: string): void {
  if (err instanceof ComplianceRegistryUnavailableError) {
    res.status(503).json({ error: err.message, code: "REGISTRY_UNAVAILABLE" });
    return;
  }
  const message = err instanceof Error ? err.message : "calldata failed";
  logger.warn({ err, what }, "compliance admin route error");
  res.status(400).json({ error: message, code: "BAD_REQUEST" });
}

function validateExpiry(expiry: number): bigint {
  if (expiry !== 0 && expiry < Math.floor(Date.now() / 1000)) {
    throw new Error("expiry must be 0 (no expiry) or a future unix timestamp");
  }
  return BigInt(expiry);
}

complianceAdminRouter.post(
  "/api/compliance/whitelist/add/calldata",
  writeRateLimiter,
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", code: "BAD_REQUEST", details: parsed.error.issues });
      return;
    }
    try {
      const tx = buildAddToWhitelist(parsed.data.account, validateExpiry(parsed.data.expiry));
      res.json(tx);
    } catch (err) {
      handleError(res, err, "add");
    }
  },
);

complianceAdminRouter.post(
  "/api/compliance/whitelist/batch-add/calldata",
  writeRateLimiter,
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", code: "BAD_REQUEST", details: parsed.error.issues });
      return;
    }
    try {
      const expiries = parsed.data.expiries.map(validateExpiry);
      const tx = buildBatchAddToWhitelist(parsed.data.accounts, expiries);
      res.json(tx);
    } catch (err) {
      handleError(res, err, "batch_add");
    }
  },
);

complianceAdminRouter.post(
  "/api/compliance/whitelist/remove/calldata",
  writeRateLimiter,
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    const parsed = removeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", code: "BAD_REQUEST", details: parsed.error.issues });
      return;
    }
    try {
      const tx = buildRemoveFromWhitelist(parsed.data.account);
      res.json(tx);
    } catch (err) {
      handleError(res, err, "remove");
    }
  },
);

complianceAdminRouter.post(
  "/api/compliance/record",
  writeRateLimiter,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", code: "BAD_REQUEST" });
      return;
    }
    const ctx = getRequestContext(req);
    const { txHash, action, accounts, outcome } = parsed.data;
    await logAudit({
      ...ctx,
      action: `compliance_${action}`,
      outcome,
      txHash,
      params: { accounts },
    });
    res.json({ ok: true });
  },
);
