import { z } from "zod";
import { ARC_TESTNET_CHAIN_ID, isSupportedTestnetChainId } from "../lib/chains.ts";
import { isTokenSymbol } from "../lib/tokens.ts";
import { isFeeTier } from "../lib/v4-contracts.ts";

export const slot0QuerySchema = z.object({
  tokenA: z.string().refine(isTokenSymbol, "Unknown tokenA"),
  tokenB: z.string().refine(isTokenSymbol, "Unknown tokenB"),
  fee: z.coerce.number().int().refine(isFeeTier, "Fee tier must be 100/500/3000/10000"),
  // Optional for back-compat; older clients meant Arc.
  chainId: z.coerce
    .number()
    .int()
    .refine(isSupportedTestnetChainId, "Unsupported chainId")
    .default(ARC_TESTNET_CHAIN_ID),
});
