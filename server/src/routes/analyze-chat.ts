import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../env.ts";
import { logger } from "../lib/logger.ts";
import { runResearchChat, type ResearchHistoryTurn } from "../lib/research-chat.ts";
import { type AgentChatEvent } from "../lib/agent-chat.ts";
import { walletRateLimiter } from "../middleware/rate-limit.ts";

export const analyzeChatRouter = Router();

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(8000) }))
    .max(20)
    .optional(),
});

/**
 * POST /api/analyze/chat — streaming, read-only research analyst (SSE).
 *
 * Public + unauthenticated by design: research is read-only. Rate-limited
 * per-IP via `walletRateLimiter` (it falls back to IP when no wallet). Mirrors
 * the agent-chat SSE framing so the client reader/renderer is shared.
 */
analyzeChatRouter.post(
  "/api/analyze/chat",
  walletRateLimiter,
  async (req: Request, res: Response) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", code: "BAD_REQUEST", details: parsed.error.issues });
      return;
    }
    if (!env.ANTHROPIC_API_KEY) {
      res.status(503).json({
        error: "Research is unavailable (ANTHROPIC_API_KEY not configured).",
        code: "ANTHROPIC_UNAVAILABLE",
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    const write = (event: AgentChatEvent): void => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const history: ResearchHistoryTurn[] = parsed.data.history ?? [];
      for await (const event of runResearchChat({ message: parsed.data.message, history })) {
        if (res.closed) break;
        write(event);
      }
    } catch (err) {
      logger.error({ err }, "analyze chat stream failed");
      if (!res.closed) write({ type: "error", message: "The analyst hit an unexpected error." });
    } finally {
      res.end();
    }
  },
);
