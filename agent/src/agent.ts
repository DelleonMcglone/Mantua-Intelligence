/**
 * Composition root — builds the Arc agent's action registry.
 *
 * Arc-only providers: ERC-8004 identity/reputation, ERC-8183 jobs, and
 * balances, bound to a plain viem wallet on Arc (no Coinbase AgentKit / CDP).
 */
import { loadContractConfig } from "./config/contracts.ts";
import { loadEnv } from "./config/env.ts";
import { createBalancesActionProvider } from "./action-providers/balances.ts";
import { createErc8004ActionProvider } from "./action-providers/erc8004.ts";
import { createErc8183ActionProvider } from "./action-providers/erc8183.ts";
import { createActionKit, type ActionKit } from "./lib/action-kit.ts";
import { createArcWallet } from "./lib/wallet.ts";

export function createArcAgentKit(): ActionKit {
  const env = loadEnv();
  const contracts = loadContractConfig(env);
  const wallet = createArcWallet(env);

  return createActionKit(wallet, [
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
  ]);
}
