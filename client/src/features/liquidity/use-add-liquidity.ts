import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { ACTIVE_CHAIN, ACTIVE_CHAIN_ID } from "@/lib/chain.ts";
import { ApiError, api } from "@/lib/api.ts";
import { IS_MAINNET, TOKENS, type TokenSymbol } from "@/lib/tokens.ts";
import type { FeeTier } from "./fee-tiers.ts";
import { ensurePermit2Approval } from "./erc20-allowance.ts";
import { extractMintedTokenId } from "./extract-token-id.ts";
import {
  buildSignTypedDataArgs,
  wrapInMulticall,
  type Permit2Bundle,
} from "./permit2-helpers.ts";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

const baseRpcUrl: string =
  (import.meta.env.VITE_BASE_RPC_URL as string | undefined) ??
  (IS_MAINNET ? "https://mainnet.base.org" : "https://sepolia.base.org");
const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http(baseRpcUrl) });

export interface AddLiquidityArgs {
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  amountARaw: string;
  amountBRaw: string;
  /** Optional. Omit for existing-pool adds — the server reads slot0
   *  via StateView and returns the resolved price in the response. */
  sqrtPriceX96?: string;
  slippageBps: number;
}

interface CalldataRes {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  liquidity: string;
  amount0Max: string;
  amount1Max: string;
  tickLower: number;
  tickUpper: number;
  poolKeyHash: `0x${string}`;
  /** Always populated by the server — either echoed from the request
   *  or freshly resolved via StateView.getSlot0. */
  sqrtPriceX96: string;
  /** Non-null when the user's Permit2 → PositionManager allowance for
   *  one or both ERC-20 sides is missing or stale. Client signs the
   *  typed data and wraps the permitBatch into a multicall. */
  permit2: Permit2Bundle | null;
}

interface AddState {
  status: "idle" | "preparing" | "approving" | "signing" | "pending" | "success" | "error";
  txHash?: `0x${string}`;
  approvalTx?: `0x${string}`;
  error?: ApiError | Error;
  message?: string;
}

export function useAddLiquidity() {
  const { wallets } = useWallets();
  const [state, setState] = useState<AddState>({ status: "idle" });

  async function execute(args: AddLiquidityArgs): Promise<`0x${string}` | null> {
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime defensive
      if (!wallet) throw new Error("No wallet connected");
      if (wallet.chainId !== `eip155:${String(ACTIVE_CHAIN_ID)}`) {
        await wallet.switchChain(ACTIVE_CHAIN_ID);
      }
      const owner = wallet.address as `0x${string}`;
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: owner,
        chain: ACTIVE_CHAIN,
        transport: custom(provider),
      });

      setState({ status: "preparing" });
      const calldata = await api.post<CalldataRes>("/api/liquidity/add/calldata", {
        ...args,
        deadlineSeconds: Math.floor(Date.now() / 1000) + 1200,
      });

      setState({ status: "approving", message: "Checking Permit2 approvals…" });
      const tA = TOKENS[args.tokenA];
      const tB = TOKENS[args.tokenB];
      const approvalA = await ensurePermit2Approval(
        walletClient,
        publicClient,
        tA.native ? ZERO : tA.address,
        owner,
      );
      const approvalB = await ensurePermit2Approval(
        walletClient,
        publicClient,
        tB.native ? ZERO : tB.address,
        owner,
      );

      let to = calldata.to;
      let data = calldata.data;
      if (calldata.permit2) {
        setState({
          status: "signing",
          message: "Sign Permit2 batch in your wallet…",
          ...(approvalA ? { approvalTx: approvalA } : approvalB ? { approvalTx: approvalB } : {}),
        });
        const signTypedDataArgs = buildSignTypedDataArgs(calldata.permit2.typedData);
        const signature = await walletClient.signTypedData({
          account: owner,
          ...signTypedDataArgs,
        });
        const wrapped = wrapInMulticall(
          owner,
          calldata.permit2.permitBatch,
          signature,
          calldata.data,
        );
        to = wrapped.to;
        data = wrapped.data;
      }

      setState({
        status: "signing",
        ...(approvalA ? { approvalTx: approvalA } : approvalB ? { approvalTx: approvalB } : {}),
      });
      const txHash = await walletClient.sendTransaction({
        account: owner,
        chain: ACTIVE_CHAIN,
        to,
        data,
        value: BigInt(calldata.value),
      });
      setState({ status: "pending", txHash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const outcome = receipt.status === "success" ? "success" : "failure";

      // Extract the minted PositionManager NFT tokenId from receipt logs
      // so the remove-liquidity flow can reference this position later.
      const tokenId =
        outcome === "success" ? extractMintedTokenId(receipt, owner) : null;

      void api.post("/api/liquidity/add/record", {
        txHash,
        tokenA: args.tokenA,
        tokenB: args.tokenB,
        fee: args.fee,
        amountARaw: args.amountARaw,
        amountBRaw: args.amountBRaw,
        liquidity: calldata.liquidity,
        tickLower: calldata.tickLower,
        tickUpper: calldata.tickUpper,
        poolKeyHash: calldata.poolKeyHash,
        sqrtPriceX96: calldata.sqrtPriceX96,
        ...(tokenId ? { tokenId } : {}),
        outcome,
      });

      setState({
        status: outcome === "success" ? "success" : "error",
        txHash,
        ...(outcome === "failure" ? { error: new Error("Transaction reverted") } : {}),
      });
      return txHash;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("add liquidity failed");
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
