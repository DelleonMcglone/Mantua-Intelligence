import { Router } from "express";
import { env } from "../env.ts";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    env: env.NODE_ENV,
    killSwitch: env.MANTUA_KILL_SWITCH,
  });
});
