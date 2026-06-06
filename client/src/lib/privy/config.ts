import { base, baseSepolia } from "viem/chains";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { IS_MAINNET } from "../tokens.ts";

/**
 * Privy app configuration.
 *  - D-005 ACCEPTED: email + Google + Apple + passkey + external wallet
 *  - D-006 ACCEPTED: createOnLogin = 'users-without-wallets'
 *  - D-007 ACCEPTED: WalletConnect enabled with project ID
 *  - Testnet beta runs on Base Sepolia (84532). Mainnet
 *    (`VITE_MANTUA_NETWORK=mainnet`) switches to Base Mainnet —
 *    mainnet redeploys are launch-gating, separate work.
 */
const SUPPORTED_TESTNET_CHAINS = [baseSepolia];

const DEFAULT_CHAIN = IS_MAINNET ? base : baseSepolia;
const SUPPORTED_CHAINS = IS_MAINNET ? [base] : SUPPORTED_TESTNET_CHAINS;

export const privyConfig: PrivyClientConfig = {
  appearance: { theme: "dark", accentColor: "#8b6cf0" },
  loginMethods: ["email", "google", "apple", "passkey", "wallet"],
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
  },
  walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  // viem `Chain` type drifts between our copy and Privy's bundled
  // (porto-vendored) copy under `exactOptionalPropertyTypes: true`.
  // Runtime value is identical; @ts-expect-error silences the
  // structural mismatch.
  // @ts-expect-error -- viem Chain version drift (Privy vendors its own viem)
  defaultChain: DEFAULT_CHAIN,
  // @ts-expect-error -- viem Chain version drift (Privy vendors its own viem)
  supportedChains: SUPPORTED_CHAINS,
};

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

if (!PRIVY_APP_ID) {
  throw new Error(
    "VITE_PRIVY_APP_ID is missing. Add it to client/.env.local — see client/.env.example.",
  );
}
