import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { env } from "../../env.ts";
import { logger } from "../logger.ts";

type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;

let cached: CircleClient | null = null;
let cachedWalletSetId: string | null = null;

export class CircleUnavailableError extends Error {
  constructor() {
    super(
      "Circle credentials not configured. Required env: CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET (a registered entity secret from the Circle Developer Console).",
    );
    this.name = "CircleUnavailableError";
  }
}

/**
 * Lazy singleton for the Circle Developer-Controlled Wallets SDK — the
 * agent-wallet provider on Arc. Mirrors the old `getCdpClient()`: the server
 * boots without Circle creds (they're `.optional()` in env.ts) and the first
 * call either constructs the client or throws `CircleUnavailableError`, which
 * routes catch and surface as 503 so the rest of the API stays up.
 */
export function getCircleClient(): CircleClient {
  if (cached) return cached;
  const { CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET } = env;
  if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET) {
    throw new CircleUnavailableError();
  }
  cached = initiateDeveloperControlledWalletsClient({
    apiKey: CIRCLE_API_KEY,
    entitySecret: CIRCLE_ENTITY_SECRET,
  });
  return cached;
}

/**
 * The wallet set agent wallets are created in. Prefer `CIRCLE_WALLET_SET_ID`
 * from env (set it once you've created one). If unset, create a wallet set on
 * first use and cache it for the process lifetime — and log the id loudly so
 * the operator can persist it to env and avoid a fresh set per cold start.
 */
export async function getAgentWalletSetId(): Promise<string> {
  if (env.CIRCLE_WALLET_SET_ID) return env.CIRCLE_WALLET_SET_ID;
  if (cachedWalletSetId) return cachedWalletSetId;
  const res = await getCircleClient().createWalletSet({ name: "Mantua Agent Wallets" });
  const id = res.data?.walletSet.id;
  if (!id) throw new Error("Circle createWalletSet returned no wallet set id");
  cachedWalletSetId = id;
  logger.warn(
    { walletSetId: id },
    "Created a Circle wallet set on the fly — set CIRCLE_WALLET_SET_ID in env to reuse it across restarts.",
  );
  return id;
}

/** Test-only escape hatch — inject a fake client (or null to reset). */
export function setCircleClientForTesting(client: CircleClient | null): void {
  cached = client;
}
