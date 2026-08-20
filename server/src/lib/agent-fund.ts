import {
  AgentWalletNotFoundError,
  circleBlockchainFor,
  getAgentWallet,
  type CircleBlockchain,
} from "./agent-wallet.ts";
import { ARC_TESTNET_CHAIN_ID, type SupportedTestnetChainId } from "./chains.ts";
import { getCircleClient } from "./circle/client.ts";

export interface AgentFundResult {
  agentAddress: string;
  blockchain: CircleBlockchain;
  requested: { usdc: boolean; native: boolean };
}

/**
 * Request testnet USDC for the agent wallet from Circle's faucet on Arc.
 *
 * Note: Circle's `/v1/faucet/drips` API may require a mainnet-upgraded Circle
 * account — on a fresh test account it can reject the request, in which case
 * fund the agent address manually via the Arc testnet faucet. Transaction gas
 * itself is sponsored by Circle Gas Station, so this is only about giving the
 * agent token balances to trade/transfer with.
 */
export async function fundAgentWallet(
  privyUserId: string,
  chainId: SupportedTestnetChainId = ARC_TESTNET_CHAIN_ID,
): Promise<AgentFundResult> {
  const wallet = await getAgentWallet(privyUserId, chainId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);

  const blockchain = circleBlockchainFor(chainId);
  // On Base Sepolia gas is ETH, so request a native drip alongside USDC
  // (Arc sponsors gas via Gas Station and uses USDC natively).
  const native = blockchain === "BASE-SEPOLIA";
  await (
    await getCircleClient()
  ).requestTestnetTokens({
    address: wallet.address,
    blockchain,
    usdc: true,
    ...(native ? { native: true } : {}),
  });

  return { agentAddress: wallet.address, blockchain, requested: { usdc: true, native } };
}
