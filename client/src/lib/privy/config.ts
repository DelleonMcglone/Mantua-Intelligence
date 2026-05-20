import { base, baseSepolia } from "viem/chains";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { unichainSepolia } from "../chains.ts";
import { IS_MAINNET } from "../tokens.ts";

/**
 * Privy app configuration.
 *  - D-005 ACCEPTED: email + Google + Apple + passkey + external wallet
 *  - D-006 ACCEPTED: createOnLogin = 'users-without-wallets'
 *  - D-007 ACCEPTED: WalletConnect enabled with project ID
 *  - PR #101: testnet beta supports BOTH Base Sepolia (84532) and
 *    Unichain Sepolia (1301). Default chain is Base Sepolia; the user
 *    switches via the chain selector in `InputBar.tsx`, which calls
 *    `wallet.switchChain()` against the chosen id. Mainnet
 *    (`VITE_MANTUA_NETWORK=mainnet`) collapses back to Base Mainnet
 *    single-chain — mainnet redeploys are launch-gating, separate work.
 */
const SUPPORTED_TESTNET_CHAINS = [baseSepolia, unichainSepolia];

const DEFAULT_CHAIN = IS_MAINNET ? base : baseSepolia;
const SUPPORTED_CHAINS = IS_MAINNET ? [base] : SUPPORTED_TESTNET_CHAINS;

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
  | string
  | undefined;

export const privyConfig: PrivyClientConfig = {
  appearance: { theme: "dark", accentColor: "#8b6cf0" },
  loginMethods: ["email", "google", "apple", "passkey", "wallet"],
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
  },
  walletConnectCloudProjectId: WALLETCONNECT_PROJECT_ID,
  // viem `Chain` type drifts between our copy and Privy's bundled
  // (porto-vendored) copy under `exactOptionalPropertyTypes: true`.
  // Runtime value is identical; @ts-expect-error silences the
  // structural mismatch.
  // @ts-expect-error -- viem Chain version drift (Privy vendors its own viem)
  defaultChain: DEFAULT_CHAIN,
  // @ts-expect-error -- viem Chain version drift (Privy vendors its own viem)
  supportedChains: SUPPORTED_CHAINS,
};

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;
