import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import { BASESCAN_TX, type TokenSymbol } from "@/lib/tokens.ts";
import { FEE_TIER_LABELS, type FeeTier } from "./fee-tiers.ts";
import { PairCell } from "./PairCell.tsx";
import { SlippageRow } from "./SlippageRow.tsx";
import { ratioLabel, safeParse } from "./create-helpers.ts";
import { addCtaLabel } from "./add-helpers.ts";
import { useAddLiquidity } from "./use-add-liquidity.ts";

export interface PoolKeyContext {
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  /** Set by the pool-create flow with the just-initialized price.
   *  Omitted when entering from PoolDetailPage — server reads slot0. */
  sqrtPriceX96?: string;
}

interface Props {
  ctx: PoolKeyContext;
  onBack: () => void;
  onClose?: () => void;
}

/**
 * Full-range add-liquidity form. Inherits the PoolKey from either the
 * pool-create flow (with a known sqrtPriceX96) or the PoolDetailPage
 * (where the server reads slot0 via StateView at calldata time).
 */
export function AddLiquidityForm({ ctx, onBack, onClose }: Props) {
  const [amountA, setAmountA] = useState("0.1");
  const [amountB, setAmountB] = useState("360");
  const [slippageBps, setSlippageBps] = useState(50);
  const confirm = useConfirmedAction();
  const add = useAddLiquidity();

  const amountARaw = safeParse(ctx.tokenA, amountA);
  const amountBRaw = safeParse(ctx.tokenB, amountB);
  const ready = amountARaw !== "0" && amountBRaw !== "0";

  async function onSubmit() {
    if (!ready) return;
    const ok = await confirm({
      title: `Add liquidity to ${ctx.tokenA}/${ctx.tokenB}`,
      description: `${amountA} ${ctx.tokenA} + ${amountB} ${ctx.tokenB} · fee ${FEE_TIER_LABELS[ctx.fee]} · slippage ${(slippageBps / 100).toFixed(2)}%`,
      doubleConfirm: slippageBps >= 100,
      severity: slippageBps >= 100 ? "warning" : "default",
      confirmLabel: "Approve & add",
    });
    if (!ok) return;
    await add.execute({
      tokenA: ctx.tokenA,
      tokenB: ctx.tokenB,
      fee: ctx.fee,
      amountARaw,
      amountBRaw,
      ...(ctx.sqrtPriceX96 ? { sqrtPriceX96: ctx.sqrtPriceX96 } : {}),
      slippageBps,
    });
  }

  return (
    <>
      <PanelHeader />
      <PanelSubHeader
        title={`Add liquidity · ${ctx.tokenA}/${ctx.tokenB}`}
        subtitle={FEE_TIER_LABELS[ctx.fee]}
        onBack={onBack}
        {...(onClose ? { onClose } : {})}
      />

      <div className="flex-1 overflow-auto px-5 pt-2 pb-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <PairCell
            label={ctx.tokenA}
            symbol={ctx.tokenA}
            onSymbolChange={() => undefined}
            disabledSymbol={ctx.tokenB}
            amount={amountA}
            onAmountChange={setAmountA}
          />
          <PairCell
            label={ctx.tokenB}
            symbol={ctx.tokenB}
            onSymbolChange={() => undefined}
            disabledSymbol={ctx.tokenA}
            amount={amountB}
            onAmountChange={setAmountB}
          />
        </div>

        <div className="text-xs text-text-mute leading-relaxed">
          Range: full · 1 {ctx.tokenA} = {ratioLabel(amountA, amountB)} {ctx.tokenB}. Approvals
          to PositionManager will be requested for any non-native token without prior allowance.
        </div>

        <SlippageRow value={slippageBps} onChange={setSlippageBps} />

        <Button
          variant="primary"
          size="lg"
          disabled={!ready || add.state.status !== "idle"}
          onClick={() => {
            void onSubmit();
          }}
        >
          {addCtaLabel(add.state)}
        </Button>

        {add.state.approvalTx && (
          <a
            href={`${BASESCAN_TX}${add.state.approvalTx}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-dim hover:text-accent inline-flex items-center gap-1 justify-center"
          >
            Approval tx <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {add.state.txHash && (
          <a
            href={`${BASESCAN_TX}${add.state.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 justify-center"
          >
            View on BaseScan <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {add.state.status === "error" && add.state.error && (
          <p className="text-xs text-red text-center">{add.state.error.message}</p>
        )}
      </div>
    </>
  );
}
