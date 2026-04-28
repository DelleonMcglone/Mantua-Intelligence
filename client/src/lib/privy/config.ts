import { base, baseSepolia } from "viem/chains";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { IS_MAINNET } from "../tokens.ts";

/**
 * Privy app configuration baked from the v2 decisions:
 *  - D-005 ACCEPTED: email + Google + Apple + passkey + external wallet (no SMS)
 *  - D-006 ACCEPTED: createOnLogin = 'users-without-wallets'
 *  - D-007 ACCEPTED: WalletConnect enabled with project ID
 *  - Phase 5b: chain lock is now network-driven by VITE_MANTUA_NETWORK.
 *    Default = testnet (Base Sepolia 84532); set to "mainnet" to flip
 *    back to Base Mainnet (8453). Any other chain is rejected either way.
 */
const ACTIVE_CHAIN = IS_MAINNET ? base : baseSepolia;

export const privyConfig: PrivyClientConfig = {
  appearance: { theme: "dark", accentColor: "#8b6cf0" },
  loginMethods: ["email", "google", "apple", "passkey", "wallet"],
  // Bug fix: Privy 3.22 nests `createOnLogin` under `embeddedWallets.ethereum`
  // (Solana support added a sibling). Old top-level shape from Privy 2.x
  // fails typecheck.
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
  },
  walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  // Bug fix: viem `Chain` type drifts between our copy and Privy's bundled
  // (porto-vendored) copy under `exactOptionalPropertyTypes: true`. Runtime
  // value is identical; @ts-expect-error silences the structural mismatch.
  // @ts-expect-error -- viem Chain version drift (Privy vendors its own viem)
  defaultChain: ACTIVE_CHAIN,
  // @ts-expect-error -- viem Chain version drift (Privy vendors its own viem)
  supportedChains: [ACTIVE_CHAIN],
};

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

if (!PRIVY_APP_ID) {
  throw new Error(
    "VITE_PRIVY_APP_ID is missing. Add it to client/.env.local — see client/.env.example.",
  );
}
