import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import type {
  BridgeResult,
  BridgeStep,
  ChainDefinition,
  EstimateResult,
} from "@circle-fin/app-kit";
import {
  type BridgeChainKey,
  bridgeChainByKey,
  createWalletAdapter,
  getAppKit,
  getBridgeChainDef,
} from "./appkit.ts";

export type TransferSpeedMode = "FAST" | "SLOW";

export interface BridgeArgs {
  from: BridgeChainKey;
  to: BridgeChainKey;
  /** Human-readable USDC amount, e.g. "10.5". */
  amount: string;
  /** Mint recipient; defaults to the connected wallet's address. */
  recipient?: string;
  /** CCTP burn mode. Defaults to FAST. */
  transferSpeed?: TransferSpeedMode;
}

export type BridgeStatus = "idle" | "estimating" | "estimated" | "bridging" | "success" | "error";

export interface BridgeFlowState {
  status: BridgeStatus;
  estimate?: EstimateResult;
  result?: BridgeResult;
  steps: BridgeStep[];
  error?: Error;
}

/**
 * Drives a CCTP-v2 USDC bridge through Circle App Kit, signed by the
 * user's Privy wallet. App Kit's viem adapter handles the EIP-1193 chain
 * switch to the source chain, the approve+burn there, attestation
 * polling, and the mint on the destination chain — so this hook just
 * builds the params, awaits, and surfaces per-step progress.
 */
export function useBridge() {
  const { wallets } = useWallets();
  const [state, setState] = useState<BridgeFlowState>({ status: "idle", steps: [] });

  function activeWallet() {
    const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime defensive: wallets can be empty
    if (!wallet) throw new Error("No wallet connected");
    return wallet;
  }

  async function buildParams(args: BridgeArgs) {
    const wallet = activeWallet();
    const [adapter, sourceChain, destinationChain] = await Promise.all([
      createWalletAdapter(wallet),
      getBridgeChainDef(args.from),
      getBridgeChainDef(args.to),
    ]);
    // The kit-level params use `from`/`to` adapter contexts; the address
    // is derived from the adapter, so it's omitted (a custom mint target
    // is passed via `recipientAddress`). App Kit's exported chain consts
    // are deeply `readonly`, so cast to the mutable `ChainDefinition`.
    return {
      from: { adapter, chain: sourceChain as ChainDefinition },
      to: {
        adapter,
        chain: destinationChain as ChainDefinition,
        ...(args.recipient ? { recipientAddress: args.recipient } : {}),
      },
      amount: args.amount,
      token: "USDC" as const,
      config: { transferSpeed: args.transferSpeed ?? "FAST" },
    };
  }

  /** Fetch gas + protocol fee estimates without moving funds. */
  async function estimate(args: BridgeArgs): Promise<EstimateResult | null> {
    try {
      setState({ status: "estimating", steps: [] });
      const [kit, params] = await Promise.all([getAppKit(), buildParams(args)]);
      const result = await kit.estimateBridge(params);
      setState({ status: "estimated", estimate: result, steps: [] });
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Bridge estimate failed");
      setState({ status: "error", steps: [], error: e });
      return null;
    }
  }

  /** Execute the bridge: approve + burn on source, attest, mint on destination. */
  async function execute(args: BridgeArgs): Promise<BridgeResult | null> {
    try {
      setState({ status: "bridging", steps: [] });
      const [kit, params] = await Promise.all([getAppKit(), buildParams(args)]);
      const result = await kit.bridge(params);
      const ok = result.state === "success";
      setState({
        status: ok ? "success" : "error",
        result,
        steps: result.steps,
        ...(ok ? {} : { error: new Error(stepError(result.steps) ?? "Bridge failed") }),
      });
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Bridge failed");
      setState((s) => ({ ...s, status: "error", error: e }));
      return null;
    }
  }

  return {
    state,
    estimate,
    execute,
    reset: () => {
      setState({ status: "idle", steps: [] });
    },
  };
}

function stepError(steps: BridgeStep[]): string | null {
  const failed = steps.find((s) => s.state === "error");
  return failed?.errorMessage ?? null;
}

/** Human-readable label for a CCTP fee bucket. */
export function feeTypeLabel(type: "kit" | "provider" | "forwarder"): string {
  switch (type) {
    case "kit":
      return "Service fee";
    case "provider":
      return "CCTP fee";
    case "forwarder":
      return "Relayer fee";
  }
}

export { bridgeChainByKey };
