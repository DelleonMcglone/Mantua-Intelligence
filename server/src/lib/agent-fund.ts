import { AgentWalletNotFoundError, getAgentWallet } from "./agent-wallet.ts";
import { getCircleClient } from "./circle/client.ts";

export interface AgentFundResult {
  agentAddress: string;
  blockchain: "ARC-TESTNET";
  requested: { usdc: boolean };
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
export async function fundAgentWallet(privyUserId: string): Promise<AgentFundResult> {
  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);

  await getCircleClient().requestTestnetTokens({
    address: wallet.address,
    blockchain: "ARC-TESTNET",
    usdc: true,
  });

  return { agentAddress: wallet.address, blockchain: "ARC-TESTNET", requested: { usdc: true } };
}
