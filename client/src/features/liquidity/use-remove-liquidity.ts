import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { base } from "viem/chains";
import { ApiError, api } from "@/lib/api.ts";

const BASE_CHAIN_ID = 8453;
const baseRpcUrl: string =
  (import.meta.env.VITE_BASE_RPC_URL as string | undefined) ?? "https://mainnet.base.org";
const publicClient = createPublicClient({ chain: base, transport: http(baseRpcUrl) });

export interface RemoveArgs {
  positionId: string;
  percentage: number;
  slippageBps: number;
}

interface CalldataRes {
  to: `0x${string}`;
  data: `0x${string}`;
  amount0Min: string;
  amount1Min: string;
  amount0Estimate: string;
  amount1Estimate: string;
  isFullExit: boolean;
  liquidityToRemove: string;
  positionLiquidity: string;
}

interface RemoveState {
  status: "idle" | "preparing" | "signing" | "pending" | "success" | "error";
  txHash?: `0x${string}`;
  error?: ApiError | Error;
}

export function useRemoveLiquidity() {
  const { wallets } = useWallets();
  const [state, setState] = useState<RemoveState>({ status: "idle" });

  async function execute(args: RemoveArgs): Promise<`0x${string}` | null> {
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime defensive
      if (!wallet) throw new Error("No wallet connected");
      if (wallet.chainId !== `eip155:${String(BASE_CHAIN_ID)}`) {
        await wallet.switchChain(BASE_CHAIN_ID);
      }
      const owner = wallet.address as `0x${string}`;
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: owner,
        chain: base,
        transport: custom(provider),
      });

      setState({ status: "preparing" });
      const calldata = await api.post<CalldataRes>("/api/liquidity/remove/calldata", {
        ...args,
        deadlineSeconds: Math.floor(Date.now() / 1000) + 1200,
      });

      setState({ status: "signing" });
      const txHash = await walletClient.sendTransaction({
        account: owner,
        chain: base,
        to: calldata.to,
        data: calldata.data,
      });
      setState({ status: "pending", txHash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const outcome = receipt.status === "success" ? "success" : "failure";

      void api.post("/api/liquidity/remove/record", {
        txHash,
        positionId: args.positionId,
        liquidityRemoved: calldata.liquidityToRemove,
        isFullExit: calldata.isFullExit,
        outcome,
      });

      setState({
        status: outcome === "success" ? "success" : "error",
        txHash,
        ...(outcome === "failure" ? { error: new Error("Transaction reverted") } : {}),
      });
      return txHash;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("remove liquidity failed");
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
