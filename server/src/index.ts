import express from "express";
import pinoHttp from "pino-http";
import { env } from "./env.ts";
import { logger } from "./lib/logger.ts";
import { attachAuth } from "./middleware/auth.ts";
import { killSwitch } from "./middleware/kill-switch.ts";
import { ipRateLimiter } from "./middleware/rate-limit.ts";
import { healthRouter } from "./routes/health.ts";
import { liquidityAddRouter } from "./routes/liquidity-add.ts";
import { liquidityRemoveRouter } from "./routes/liquidity-remove.ts";
import { poolCreateRouter } from "./routes/pool-create.ts";
import { poolsRouter } from "./routes/pools.ts";
import { positionsRouter } from "./routes/positions.ts";
import { quoteRouter } from "./routes/quote.ts";
import { swapRouter } from "./routes/swap.ts";

const app = express();
app.set("trust proxy", 1);
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(ipRateLimiter);
app.use(killSwitch);
app.use(attachAuth);

app.use(healthRouter);
app.use(poolsRouter);
app.use(poolCreateRouter);
app.use(liquidityAddRouter);
app.use(liquidityRemoveRouter);
app.use(positionsRouter);
app.use(quoteRouter);
app.use(swapRouter);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening");
});
