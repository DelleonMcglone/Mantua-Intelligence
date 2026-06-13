import type { PrivyClientConfig } from "@privy-io/react-auth";
import { arbitrumSepolia, baseSepolia, sepolia, unichainSepolia } from "viem/chains";
import { arcTestnet } from "../chains.ts";

/**
 * Privy app configuration.
 *  - D-005 ACCEPTED: email + Google + Apple + passkey + external wallet
 *  - D-006 ACCEPTED: createOnLogin = 'users-without-wallets'
 *  - D-007 ACCEPTED: WalletConnect enabled with project ID
 *  - Mantua's app surface (swaps, pools, liquidity) runs on Arc Testnet
 *    (5042002) only — Circle's USDC-gas chain; Arc is the default chain.
 *  - The Bridge panel (CCTP via App Kit) moves USDC between Arc and the
 *    four source testnets below. They're listed as `supportedChains` so
 *    the embedded wallet can switch to them for the burn step; they are
 *    NOT selectable elsewhere in the app.
 */
const DEFAULT_CHAIN = arcTestnet;
const SUPPORTED_CHAINS = [arcTestnet, sepolia, baseSepolia, arbitrumSepolia, unichainSepolia];

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

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;

if (!PRIVY_APP_ID) {
  throw new Error(
    "VITE_PRIVY_APP_ID is missing. Add it to client/.env.local — see client/.env.example.",
  );
}
