import { base } from "viem/chains";
import type { PrivyClientConfig } from "@privy-io/react-auth";

/**
 * Privy app configuration baked from the v2 decisions:
 *  - D-005 ACCEPTED: email + Google + Apple + passkey + external wallet (no SMS)
 *  - D-006 ACCEPTED: createOnLogin = 'users-without-wallets'
 *  - D-007 ACCEPTED: WalletConnect enabled with project ID
 *  - Chain lock: Base Mainnet (8453) ONLY — any other chain is rejected
 */
export const privyConfig: PrivyClientConfig = {
  appearance: { theme: "dark", accentColor: "#8b6cf0" },
  loginMethods: ["email", "google", "apple", "passkey", "wallet"],
  embeddedWallets: {
    createOnLogin: "users-without-wallets",
    requireUserPasswordOnCreate: false,
  },
  walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  defaultChain: base,
  supportedChains: [base],
};

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

if (!PRIVY_APP_ID) {
  throw new Error(
    "VITE_PRIVY_APP_ID is missing. Add it to client/.env.local — see client/.env.example.",
  );
}
