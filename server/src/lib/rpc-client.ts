import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { env } from "../env.ts";

/**
 * Server-side viem public client on Base. Used for read-only on-chain
 * lookups (StateView.getSlot0, ERC-20 metadata, etc.). Write paths stay
 * client-side in the user's wallet.
 */
export const baseRpcClient = createPublicClient({
  chain: base,
  transport: http(env.BASE_RPC_URL),
});
