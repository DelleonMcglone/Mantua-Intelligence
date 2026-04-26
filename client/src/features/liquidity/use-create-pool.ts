import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { base } from "viem/chains";
import { ApiError, api } from "@/lib/api.ts";
import type { TokenSymbol } from "@/lib/tokens.ts";
import type { FeeTier } from "./fee-tiers.ts";

const BASE_CHAIN_ID = 8453;

const baseRpcUrl: string =
  (import.meta.env.VITE_BASE_RPC_URL as string | undefined) ?? "https://mainnet.base.org";

const publicClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
});

interface CalldataReq {
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  initialAmount0Raw: string;
  initialAmount1Raw: string;
}

interface CalldataRes {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  poolKey: { currency0: string; currency1: string; sqrtPriceX96: string };
}

interface CreateState {
  status: "idle" | "preparing" | "signing" | "pending" | "success" | "error";
  txHash?: `0x${string}`;
  poolKey?: CalldataRes["poolKey"];
  error?: ApiError | Error;
}

export function useCreatePool() {
  const { wallets } = useWallets();
  const [state, setState] = useState<CreateState>({ status: "idle" });

  async function execute(req: CalldataReq): Promise<`0x${string}` | null> {
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      // Privy types `useWallets()` so this assertion is "always" satisfied,
      // but at runtime the array can be empty during transitional auth states.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!wallet) throw new Error("No wallet connected");
      const targetChainId = `eip155:${String(BASE_CHAIN_ID)}`;
      if (wallet.chainId !== targetChainId) {
        await wallet.switchChain(BASE_CHAIN_ID);
      }

      setState({ status: "preparing" });
      const calldata = await api.post<CalldataRes>("/api/pools/create/calldata", req);

      setState({ status: "signing", poolKey: calldata.poolKey });
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: base,
        transport: custom(provider),
      });
      const txHash = await walletClient.sendTransaction({
        account: wallet.address as `0x${string}`,
        chain: base,
        to: calldata.to,
        data: calldata.data,
        value: BigInt(calldata.value),
      });
      setState({ status: "pending", txHash, poolKey: calldata.poolKey });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const outcome = receipt.status === "success" ? "success" : "failure";

      void api.post("/api/pools/create/record", {
        txHash,
        tokenA: req.tokenA,
        tokenB: req.tokenB,
        fee: req.fee,
        outcome,
      });

      setState({
        status: outcome === "success" ? "success" : "error",
        txHash,
        poolKey: calldata.poolKey,
        ...(outcome === "failure" ? { error: new Error("Transaction reverted") } : {}),
      });
      return txHash;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("create pool failed");
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
