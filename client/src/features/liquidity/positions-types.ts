export interface Position {
  id: string;
  tokenId: string | null;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  status: "open" | "closed";
  openedTx: string | null;
  closedTx: string | null;
  createdAt: string;
  poolKeyHash: string;
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  hookAddress: string | null;
  latestSqrtPriceX96: string | null;
}
