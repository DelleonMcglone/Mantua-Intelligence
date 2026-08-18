import type { PrivyClientConfig } from "@privy-io/react-auth";
import { arcTestnet } from "../chains.ts";
import { cleanEnv } from "../env.ts";

/**
 * Privy app configuration.
 *  - B6-001 (supersedes D-005): Google + email + external wallet only.
 *    Apple and passkey are dropped per the sports-pivot plan.
 *  - D-006 ACCEPTED: createOnLogin = 'users-without-wallets'
 *  - D-007 ACCEPTED: WalletConnect enabled with project ID
 *  - Mantua's entire app surface (swaps, pools, liquidity) runs on Arc
 *    Testnet (5042002) only — Circle's USDC-gas chain and the default
 *    chain. No cross-chain bridging, so Arc is the only supported chain.
 */
const DEFAULT_CHAIN = arcTestnet;
const SUPPORTED_CHAINS = [arcTestnet];

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: "dark",
    accentColor: "#8b6cf0",
    // Socials + email above the wallet section (B6-002's intended order).
    showWalletLoginFirst: false,
    // A fuller wallet grid than Privy's detected-only default.
    walletList: [
      "metamask",
      "coinbase_wallet",
      "rainbow",
      "rabby_wallet",
      "okx_wallet",
      "wallet_connect",
    ],
  },
  // NOTE: Privy offers the INTERSECTION of this list and what the Privy
  // dashboard enables — Google and Email must also be toggled on there,
  // or the modal silently degrades to wallet-only.
  loginMethods: ["google", "email", "wallet"],
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
  },
  walletConnectCloudProjectId: cleanEnv(
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined,
  ),
  defaultChain: DEFAULT_CHAIN,
  supportedChains: SUPPORTED_CHAINS,
};

/**
 * Empty string when unset. We deliberately do NOT throw at module load:
 * a top-level throw crashes the whole app into a blank white screen, which
 * is what happens on a deploy missing this env var. Instead the provider
 * renders a clear "set VITE_PRIVY_APP_ID" screen (see provider.tsx).
 */
export const PRIVY_APP_ID = cleanEnv(import.meta.env.VITE_PRIVY_APP_ID as string | undefined);
