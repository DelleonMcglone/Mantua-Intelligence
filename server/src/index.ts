import express from "express";
import pinoHttp from "pino-http";
import { env } from "./env.ts";
import { logger } from "./lib/logger.ts";
import { killSwitch } from "./middleware/kill-switch.ts";
import { healthRouter } from "./routes/health.ts";

const app = express();
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(killSwitch);

app.use(healthRouter);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening");
});
