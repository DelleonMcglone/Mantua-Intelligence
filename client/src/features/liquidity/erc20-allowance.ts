/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
/**
 * The runtime API is identical across our viem and Privy's bundled
 * (porto) viem, but the structural types don't unify under
 * `exactOptionalPropertyTypes: true`. Typing this boundary as `any`
 * is a deliberate erasure — alternatives (module augmentation, npm
 * aliasing, large structural unions) are heavier and don't add real
 * safety since both sides are well-tested viem 2.x.
 */
import { parseAbi } from "viem";
import { base } from "viem/chains";

const POSITION_MANAGER = "0x7c5f5a4bbd8fd63184577525326123b519429bdc" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const MAX_UINT = (1n << 256n) - 1n;

const erc20 = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

/**
 * If the user has not approved enough allowance to PositionManager for
 * `tokenAddr`, send a max-approval tx and wait for the receipt. Returns
 * the approval tx hash if one was sent, else null. No-op for native ETH.
 */
export async function ensureAllowance(
  walletClient: any,
  publicClient: any,
  tokenAddr: `0x${string}`,
  owner: `0x${string}`,
  needed: bigint,
): Promise<`0x${string}` | null> {
  if (tokenAddr === ZERO) return null;
  const current = (await publicClient.readContract({
    address: tokenAddr,
    abi: erc20,
    functionName: "allowance",
    args: [owner, POSITION_MANAGER],
  })) as bigint;
  if (current >= needed) return null;
  const txHash: `0x${string}` = await walletClient.writeContract({
    address: tokenAddr,
    abi: erc20,
    functionName: "approve",
    args: [POSITION_MANAGER, MAX_UINT],
    account: owner,
    chain: base,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
