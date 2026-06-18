import type { PrivyClientConfig } from "@privy-io/react-auth";
import { arcTestnet } from "../chains.ts";

/**
 * Privy app configuration.
 *  - D-005 ACCEPTED: email + Google + Apple + passkey + external wallet
 *  - D-006 ACCEPTED: createOnLogin = 'users-without-wallets'
 *  - D-007 ACCEPTED: WalletConnect enabled with project ID
 *  - Mantua's entire app surface (swaps, pools, liquidity) runs on Arc
 *    Testnet (5042002) only — Circle's USDC-gas chain and the default
 *    chain. No cross-chain bridging, so Arc is the only supported chain.
 */
const DEFAULT_CHAIN = arcTestnet;
const SUPPORTED_CHAINS = [arcTestnet];

export const privyConfig: PrivyClientConfig = {
  appearance: { theme: "dark", accentColor: "#8b6cf0" },
  loginMethods: ["email", "google", "apple", "passkey", "wallet"],
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
  },
  walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string,
  defaultChain: DEFAULT_CHAIN,
  supportedChains: SUPPORTED_CHAINS,
};

/**
 * Empty string when unset. We deliberately do NOT throw at module load:
 * a top-level throw crashes the whole app into a blank white screen, which
 * is what happens on a deploy missing this env var. Instead the provider
 * renders a clear "set VITE_PRIVY_APP_ID" screen (see provider.tsx).
 */
export const PRIVY_APP_ID = (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ?? "";
