import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";

/**
 * F10 — `useALOPlaceOrder`. Wires the LimitOrderReview place-order CTA
 * to the deployed AsyncLimitOrder hook on Base Sepolia
 * (`0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8`).
 *
 * Two-step on-chain flow:
 *   1. ERC20.approve(hook, amountIn) on the input token (the hook calls
 *      `transferFrom(msg.sender, address(this), amountIn)` internally —
 *      see `contracts/hooks/limit-orders/src/AsyncLimitOrder.sol:96`).
 *   2. AsyncLimitOrder.placeOrder(key, amountIn, targetTick, zeroForOne)
 *      — returns the orderId. We capture the tx hash and wait for the
 *      receipt; orderId extraction from logs is left to a follow-up.
 *
 * The hook is intentionally pointed at Base Sepolia (84532) — that's
 * where the ALO hook lives per `docs/security/hook-deployments.md`.
 * Mainnet support lights up when the hook ships there (Phase 9).
 */

export const ALO_HOOK_ADDRESS_SEPOLIA: Address = "0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8";

const BASE_SEPOLIA_CHAIN_ID = 84532;

const ALO_ABI = parseAbi([
  "function placeOrder(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint256 amountIn, int24 targetTick, bool zeroForOne) external returns (bytes32)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const sepoliaRpcUrl: string =
  (import.meta.env.VITE_BASE_SEPOLIA_RPC_URL as string | undefined) ?? "https://sepolia.base.org";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(sepoliaRpcUrl),
});

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface PlaceOrderArgs {
  key: PoolKey;
  /** Amount of the input token, raw (decimals already applied). */
  amountIn: bigint;
  /** Target tick (must be a multiple of `tickSpacing` per the contract's
   *  `TickNotAligned()` revert at AsyncLimitOrder.sol:99). */
  targetTick: number;
  /** true → selling currency0 for currency1, false → the reverse. */
  zeroForOne: boolean;
}

interface PlaceOrderState {
  status: "idle" | "approving" | "placing" | "pending" | "success" | "error";
  approvalTx?: `0x${string}`;
  txHash?: `0x${string}`;
  error?: Error;
}

export function useALOPlaceOrder() {
  const { wallets } = useWallets();
  const [state, setState] = useState<PlaceOrderState>({ status: "idle" });

  async function execute(args: PlaceOrderArgs): Promise<`0x${string}` | null> {
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      // Privy types `useWallets()` so this is "always" defined, but the
      // array can be empty during transitional auth states. Keep the runtime
      // check to fail loudly instead of crashing in `getEthereumProvider`.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!wallet) throw new Error("No wallet connected");

      const targetChainId = `eip155:${String(BASE_SEPOLIA_CHAIN_ID)}`;
      if (wallet.chainId !== targetChainId) {
        await wallet.switchChain(BASE_SEPOLIA_CHAIN_ID);
      }

      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: wallet.address as Address,
        chain: baseSepolia,
        transport: custom(provider),
      });

      const inputToken = args.zeroForOne ? args.key.currency0 : args.key.currency1;

      // 1) ERC20 approval — the hook calls transferFrom in placeOrder.
      setState({ status: "approving" });
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ALO_HOOK_ADDRESS_SEPOLIA, args.amountIn],
      });
      const approvalTx = await walletClient.sendTransaction({
        account: wallet.address as Address,
        chain: baseSepolia,
        to: inputToken,
        data: approveData,
        value: 0n,
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalTx });

      // 2) placeOrder.
      setState({ status: "placing", approvalTx });
      const placeData = encodeFunctionData({
        abi: ALO_ABI,
        functionName: "placeOrder",
        args: [
          {
            currency0: args.key.currency0,
            currency1: args.key.currency1,
            fee: args.key.fee,
            tickSpacing: args.key.tickSpacing,
            hooks: args.key.hooks,
          },
          args.amountIn,
          args.targetTick,
          args.zeroForOne,
        ],
      });
      const txHash = await walletClient.sendTransaction({
        account: wallet.address as Address,
        chain: baseSepolia,
        to: ALO_HOOK_ADDRESS_SEPOLIA,
        data: placeData,
        value: 0n,
      });

      setState({ status: "pending", approvalTx, txHash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const outcome = receipt.status === "success" ? "success" : "error";
      setState({
        status: outcome,
        approvalTx,
        txHash,
        ...(outcome === "error" ? { error: new Error("placeOrder reverted") } : {}),
      });
      return txHash;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("placeOrder failed");
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
