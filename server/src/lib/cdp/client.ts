import { CdpClient } from "@coinbase/cdp-sdk";
import { env } from "../../env.ts";

let cached: CdpClient | null = null;

export class CdpUnavailableError extends Error {
  constructor() {
    super(
      "CDP credentials not configured. Required env: CDP_API_KEY_NAME, CDP_API_KEY_PRIVATE_KEY, CDP_WALLET_SECRET.",
    );
    this.name = "CdpUnavailableError";
  }
}

/**
 * P6-003 — singleton accessor for the Coinbase Developer Platform SDK.
 * Lazy: the server boots without CDP creds (they're `.optional()` in
 * env.ts) and only the first call to `getCdpClient()` either constructs
 * the client or throws `CdpUnavailableError`. Routes catch that and
 * return 503 so the rest of the API stays up if CDP is misconfigured.
 */
export function getCdpClient(): CdpClient {
  if (cached) return cached;
  const { CDP_API_KEY_NAME, CDP_API_KEY_PRIVATE_KEY, CDP_WALLET_SECRET } = env;
  if (!CDP_API_KEY_NAME || !CDP_API_KEY_PRIVATE_KEY || !CDP_WALLET_SECRET) {
    throw new CdpUnavailableError();
  }
  cached = new CdpClient({
    apiKeyId: CDP_API_KEY_NAME,
    apiKeySecret: CDP_API_KEY_PRIVATE_KEY,
    walletSecret: CDP_WALLET_SECRET,
  });
  return cached;
}

/**
 * Test-only escape hatch. Tests inject a fake `CdpClient` (or pass `null`
 * to reset to "not configured"). Not exported from any production path.
 */
export function setCdpClientForTesting(client: CdpClient | null): void {
  cached = client;
}
