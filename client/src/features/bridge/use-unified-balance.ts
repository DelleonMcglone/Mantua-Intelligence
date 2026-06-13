import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { formatUnits } from "viem";
import type {
  ChainDefinition,
  DepositResult,
  EstimateSpendResult,
  GetBalancesResult,
  SpendResult,
} from "@circle-fin/app-kit";
import {
  BRIDGE_CHAINS,
  type BridgeChainKey,
  createWalletAdapter,
  getAppKit,
  getBridgeChainDef,
} from "./appkit.ts";

/**
 * Circle App Kit **Unified Balance** (Gateway v1) — a single USDC balance
 * spread across chains. Deposit USDC into the Gateway on any chain, see
 * the unified total, and spend it out to any chain. USDC-only; signed by
 * the user's Privy wallet. All five bridge chains carry Gateway config.
 */

export type AsyncStatus = "idle" | "loading" | "success" | "error";

interface BalancesState {
  status: AsyncStatus;
  data?: GetBalancesResult;
  error?: Error;
}
interface DepositState {
  status: AsyncStatus;
  result?: DepositResult;
  error?: Error;
}
interface SpendState {
  status: AsyncStatus | "estimating";
  estimate?: EstimateSpendResult;
  result?: SpendResult;
  error?: Error;
}

export interface DepositArgs {
  chain: BridgeChainKey;
  amount: string;
}
export interface SpendArgs {
  chain: BridgeChainKey;
  amount: string;
  recipient?: string;
}

/** Format a base-unit (6-dp) USDC string for display. */
export function formatUsdc(raw: string | undefined): string {
  if (!raw) return "0";
  try {
    return Number(formatUnits(BigInt(raw), 6)).toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  } catch {
    return raw;
  }
}

/** Prettify an App Kit `Blockchain` enum value, e.g. "Arc_Testnet" → "Arc Testnet". */
export function prettyChain(chain: string): string {
  return chain.replace(/_/g, " ");
}

export function useUnifiedBalance() {
  const { wallets } = useWallets();
  const [balances, setBalances] = useState<BalancesState>({ status: "idle" });
  const [deposit, setDeposit] = useState<DepositState>({ status: "idle" });
  const [spend, setSpend] = useState<SpendState>({ status: "idle" });

  function activeWallet() {
    const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime defensive: wallets can be empty
    if (!wallet) throw new Error("No wallet connected");
    return wallet;
  }

  /** Fetch the unified USDC balance across all bridge chains. */
  async function refresh(): Promise<void> {
    try {
      setBalances({ status: "loading" });
      const wallet = activeWallet();
      const [kit, adapter, ...chainDefs] = await Promise.all([
        getAppKit(),
        createWalletAdapter(wallet),
        ...BRIDGE_CHAINS.map((c) => getBridgeChainDef(c.key)),
      ]);
      const result = await kit.unifiedBalance.getBalances({
        token: "USDC",
        sources: { adapter, chains: chainDefs as ChainDefinition[] },
        networkType: "testnet",
        includePending: true,
      });
      setBalances({ status: "success", data: result });
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to load balances");
      setBalances({ status: "error", error: e });
    }
  }

  /** Deposit USDC from a chain into the unified (Gateway) balance. */
  async function executeDeposit(args: DepositArgs): Promise<DepositResult | null> {
    try {
      setDeposit({ status: "loading" });
      const wallet = activeWallet();
      const [kit, adapter, chainDef] = await Promise.all([
        getAppKit(),
        createWalletAdapter(wallet),
        getBridgeChainDef(args.chain),
      ]);
      const result = await kit.unifiedBalance.deposit({
        from: { adapter, chain: chainDef as ChainDefinition },
        amount: args.amount,
        token: "USDC",
      });
      setDeposit({ status: "success", result });
      void refresh();
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Deposit failed");
      setDeposit({ status: "error", error: e });
      return null;
    }
  }

  async function buildSpendParams(args: SpendArgs) {
    const wallet = activeWallet();
    const [adapter, chainDef] = await Promise.all([
      createWalletAdapter(wallet),
      getBridgeChainDef(args.chain),
    ]);
    // `from` selects the funding adapter (allocations auto-picked across the
    // unified balance); `to` is the destination chain + optional recipient.
    return {
      from: { adapter },
      to: {
        adapter,
        chain: chainDef as ChainDefinition,
        ...(args.recipient ? { recipientAddress: args.recipient } : {}),
      },
      token: "USDC" as const,
      amount: args.amount,
    };
  }

  /** Estimate the fees to spend from the unified balance. */
  async function estimateSpend(args: SpendArgs): Promise<EstimateSpendResult | null> {
    try {
      setSpend({ status: "estimating" });
      const [kit, params] = await Promise.all([getAppKit(), buildSpendParams(args)]);
      const estimate = await kit.unifiedBalance.estimateSpend(params);
      setSpend({ status: "idle", estimate });
      return estimate;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Spend estimate failed");
      setSpend({ status: "error", error: e });
      return null;
    }
  }

  /** Spend USDC from the unified balance to a destination chain/recipient. */
  async function executeSpend(args: SpendArgs): Promise<SpendResult | null> {
    try {
      setSpend((s) => ({ ...s, status: "loading" }));
      const [kit, params] = await Promise.all([getAppKit(), buildSpendParams(args)]);
      const result = await kit.unifiedBalance.spend(params);
      setSpend({ status: "success", result });
      void refresh();
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Spend failed");
      setSpend((s) => ({ ...s, status: "error", error: e }));
      return null;
    }
  }

  return {
    balances,
    deposit,
    spend,
    refresh,
    executeDeposit,
    estimateSpend,
    executeSpend,
    resetDeposit: () => {
      setDeposit({ status: "idle" });
    },
    resetSpend: () => {
      setSpend({ status: "idle" });
    },
  };
}
