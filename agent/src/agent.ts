/**
 * Composition root — builds the AgentKit instance for Arc testnet.
 *
 * Uses ViemWalletProvider (Arc is not a CDP-supported network, so
 * CdpWalletProvider and the CDP-native action providers — cdpApiActionProvider,
 * deploy_token, the CDP faucet, etc. — are intentionally NOT registered;
 * they assume CDP networks and would fail on Arc). Only Arc-safe providers
 * are registered: ERC-8004 identity/reputation, ERC-8183 jobs, and balances.
 */
import { AgentKit } from "@coinbase/agentkit";
import { loadContractConfig } from "./config/contracts.ts";
import { loadEnv } from "./config/env.ts";
import { createBalancesActionProvider } from "./action-providers/balances.ts";
import { createErc8004ActionProvider } from "./action-providers/erc8004.ts";
import { createErc8183ActionProvider } from "./action-providers/erc8183.ts";
import { createArcWalletProvider } from "./lib/wallet.ts";

export async function createArcAgentKit(): Promise<AgentKit> {
  const env = loadEnv();
  const contracts = loadContractConfig(env);
  const walletProvider = createArcWalletProvider(env);

  return AgentKit.from({
    walletProvider,
    actionProviders: [
      createErc8004ActionProvider({
        identityRegistry: contracts.identityRegistry,
        reputationRegistry: contracts.reputationRegistry,
        validationRegistry: contracts.validationRegistry,
      }),
      createErc8183ActionProvider({
        agenticCommerce: contracts.agenticCommerce,
        usdc: contracts.usdc,
      }),
      createBalancesActionProvider({
        allowlist: contracts.allowlist,
        lowGasWarnUsdc: env.LOW_GAS_WARN_USDC,
      }),
    ],
  });
}
