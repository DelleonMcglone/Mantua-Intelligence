import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import type { BridgeStep, ChainDefinition } from "@circle-fin/app-kit";
import {
  type BridgeChainKey,
  createWalletAdapter,
  getAppKit,
  getBridgeChainDef,
} from "./appkit.ts";

export type SendToken = "USDC" | "EURC";

export interface SendArgs {
  chain: BridgeChainKey;
  token: SendToken;
  /** Recipient address on the same chain. */
  to: string;
  /** Human-readable token amount, e.g. "10.5". */
  amount: string;
}

export type SendStatus = "idle" | "sending" | "success" | "error";

export interface SendFlowState {
  status: SendStatus;
  step?: BridgeStep;
  error?: Error;
}

/**
 * Same-chain token transfer from the user's Privy wallet via App Kit's
 * `kit.send`. USDC resolves by alias; EURC resolves to the chain's
 * `eurcAddress` (App Kit's chain registry). cirBTC is Arc-only and not an
 * App Kit token, so it's excluded — move it via the Swap panel instead.
 */
export function useSend() {
  const { wallets } = useWallets();
  const [state, setState] = useState<SendFlowState>({ status: "idle" });

  async function execute(args: SendArgs): Promise<BridgeStep | null> {
    try {
      setState({ status: "sending" });
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime defensive: wallets can be empty
      if (!wallet) throw new Error("No wallet connected");
      const [adapter, chainDef] = await Promise.all([
        createWalletAdapter(wallet),
        getBridgeChainDef(args.chain),
      ]);

      let tokenParam: "USDC" | `0x${string}` = "USDC";
      if (args.token === "EURC") {
        const eurc = chainDef.eurcAddress;
        if (!eurc) throw new Error("EURC isn't available on this chain.");
        tokenParam = eurc;
      }

      const kit = await getAppKit();
      const step = await kit.send({
        from: { adapter, chain: chainDef as ChainDefinition },
        to: args.to,
        amount: args.amount,
        token: tokenParam,
      });
      const ok = step.state !== "error";
      setState({
        status: ok ? "success" : "error",
        step,
        ...(ok ? {} : { error: new Error(step.errorMessage ?? "Send failed") }),
      });
      return step;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Send failed");
      setState({ status: "error", error: e });
      return null;
    }
  }

  return {
    state,
    execute,
    reset: () => {
      setState({ status: "idle" });
    },
  };
}
