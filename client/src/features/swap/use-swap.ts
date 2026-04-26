import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http, type WalletClient } from "viem";
import { base } from "viem/chains";
import { ApiError, api } from "@/lib/api.ts";
import { BASE_CHAIN_ID, TOKENS, type TokenSymbol } from "@/lib/tokens.ts";
import type { QuoteResponse, SwapTx } from "./types.ts";

const publicClient = createPublicClient({
  chain: base,
  transport: http(import.meta.env.VITE_BASE_RPC_URL ?? "https://mainnet.base.org"),
});

interface ExecuteParams {
  quote: QuoteResponse;
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  slippageBps?: number;
}

interface SwapState {
  status: "idle" | "signing" | "submitting" | "pending" | "success" | "error";
  txHash?: `0x${string}`;
  error?: ApiError | Error;
}

export function useSwap() {
  const { wallets } = useWallets();
  const [state, setState] = useState<SwapState>({ status: "idle" });

  async function execute({
    quote,
    tokenIn,
    tokenOut,
    slippageBps,
  }: ExecuteParams): Promise<`0x${string}` | null> {
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      if (!wallet) throw new Error("No wallet connected");
      if (wallet.chainId && wallet.chainId !== `eip155:${String(BASE_CHAIN_ID)}`) {
        await wallet.switchChain(BASE_CHAIN_ID);
      }
      const provider = await wallet.getEthereumProvider();
      const walletClient: WalletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: base,
        transport: custom(provider),
      });

      let signature: string | undefined;
      if (quote.quote.permitData) {
        setState({ status: "signing" });
        const pd = quote.quote.permitData;
        signature = await walletClient.signTypedData({
          account: wallet.address as `0x${string}`,
          domain: pd.domain as Parameters<WalletClient["signTypedData"]>[0]["domain"],
          types: pd.types as Parameters<WalletClient["signTypedData"]>[0]["types"],
          primaryType: "PermitSingle",
          message: pd.values as Record<string, unknown>,
        });
      }

      setState({ status: "submitting" });
      const { swap } = await api.post<{ swap: SwapTx }>("/api/swap/calldata", {
        quote: quote.quote,
        ...(signature ? { signature } : {}),
      });

      const txHash = await walletClient.sendTransaction({
        account: wallet.address as `0x${string}`,
        chain: base,
        to: swap.to,
        data: swap.data,
        value: BigInt(swap.value || "0"),
      });
      setState({ status: "pending", txHash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const outcome = receipt.status === "success" ? "success" : "failure";

      void api.post("/api/swap/record", {
        txHash,
        tokenIn,
        tokenOut,
        amountInRaw: quote.quote.quote.input.amount,
        amountOutRaw: quote.quote.quote.output.amount,
        ...(slippageBps !== undefined ? { slippageBps } : {}),
        outcome,
      });

      setState({ status: outcome === "success" ? "success" : "error", txHash });
      void TOKENS;
      return txHash;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("swap failed");
      setState({ status: "error", error: e });
      return null;
    }
  }

  return { state, execute, reset: () => setState({ status: "idle" }) };
}
