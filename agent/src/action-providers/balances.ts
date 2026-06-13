/**
 * Balances action provider — reports the agent's Arc balances for the
 * allowlisted assets (USDC/EURC/cirBTC via the 6/6/8-dp ERC-20 interface)
 * plus the native USDC gas balance (18-dp), and warns when gas is low.
 * There is no test ETH on Arc — gas is native USDC only; top up via the
 * Circle faucet (see docs/funding-runbook.md).
 */
import {
  type ActionProvider,
  type EvmWalletProvider,
  customActionProvider,
} from "@coinbase/agentkit";
import { formatUnits } from "viem";
import { z } from "zod";
import { ERC20_ABI } from "../abis/erc20.ts";
import type { AssetAllowlist } from "../config/assets.ts";
import { fromNativeGasUnits, toNativeGasUnits } from "../lib/decimals.ts";

const FAUCET_URL = "https://faucet.circle.com";

export interface BalancesConfig {
  allowlist: AssetAllowlist;
  /** Warn when native USDC gas balance drops below this many USDC. */
  lowGasWarnUsdc: number;
}

export function createBalancesActionProvider(
  cfg: BalancesConfig,
): ActionProvider<EvmWalletProvider> {
  return customActionProvider<EvmWalletProvider>([
    {
      name: "check_balances",
      description:
        "Report the agent's Arc balances for USDC, EURC, and cirBTC (ERC-20) plus the native USDC gas balance, warning when gas is low.",
      schema: z.object({}),
      invoke: async (wallet: EvmWalletProvider) => {
        const address = wallet.getAddress() as `0x${string}`;
        const lines = await Promise.all(
          cfg.allowlist.all().map(async (a) => {
            const raw = await wallet.readContract({
              address: a.address,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            });
            return `${a.symbol}: ${formatUnits(raw, a.decimals)}`;
          }),
        );
        const gas = await wallet.getBalance();
        const gasHuman = fromNativeGasUnits(gas);
        const low = gas < toNativeGasUnits(String(cfg.lowGasWarnUsdc));
        const warn = low
          ? `\n⚠️ Low gas: native USDC balance ${gasHuman} is below ${String(cfg.lowGasWarnUsdc)} USDC. Top up via the Circle faucet (${FAUCET_URL}).`
          : "";
        return `Arc balances for ${address}:\n  ${lines.join("\n  ")}\n  gas (native USDC, 18dp): ${gasHuman}${warn}`;
      },
    },
  ]);
}
