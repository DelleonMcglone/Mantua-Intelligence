import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card } from "@/components/shell/Card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import type { TokenSymbol } from "@/lib/tokens.ts";
import {
  DEFAULT_FEE_TIER_FOR_PAIR,
  FEE_TIER_LABELS,
  type FeeTier,
} from "./fee-tiers.ts";
import { FeeTierPicker } from "./FeeTierPicker.tsx";
import { PairCell } from "./PairCell.tsx";
import { ctaLabel, isStable, ratioLabel, safeParse } from "./create-helpers.ts";
import { useCreatePool } from "./use-create-pool.ts";

const BASESCAN_TX = "https://basescan.org/tx/";

interface Props {
  onBack: () => void;
  onAddLiquidity: (ctx: {
    tokenA: TokenSymbol;
    tokenB: TokenSymbol;
    fee: FeeTier;
    sqrtPriceX96: string;
  }) => void;
}

export function PoolCreateForm({ onBack, onAddLiquidity }: Props) {
  const [tokenA, setTokenA] = useState<TokenSymbol>("ETH");
  const [tokenB, setTokenB] = useState<TokenSymbol>("USDC");
  const [fee, setFee] = useState<FeeTier>(() =>
    DEFAULT_FEE_TIER_FOR_PAIR(isStable("ETH"), isStable("USDC")),
  );
  const [amountA, setAmountA] = useState("1");
  const [amountB, setAmountB] = useState("3600");

  const confirm = useConfirmedAction();
  const create = useCreatePool();

  const amountARaw = safeParse(tokenA, amountA);
  const amountBRaw = safeParse(tokenB, amountB);
  const ready = tokenA !== tokenB && amountARaw !== "0" && amountBRaw !== "0";

  async function onSubmit() {
    if (!ready) return;
    const ok = await confirm({
      title: `Create ${tokenA}/${tokenB} pool`,
      description: `Fee tier ${FEE_TIER_LABELS[fee]} · initial price 1 ${tokenA} = ${ratioLabel(amountA, amountB)} ${tokenB}`,
      confirmLabel: "Initialize pool",
    });
    if (!ok) return;
    await create.execute({
      tokenA,
      tokenB,
      fee,
      initialAmount0Raw: amountARaw,
      initialAmount1Raw: amountBRaw,
    });
  }

  return (
    <Card className="flex-1 flex flex-col p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-border-soft flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="text-text-dim hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold flex-1">Create pool</h2>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <PairCell
            label="Token A"
            symbol={tokenA}
            onSymbolChange={setTokenA}
            disabledSymbol={tokenB}
            amount={amountA}
            onAmountChange={setAmountA}
          />
          <PairCell
            label="Token B"
            symbol={tokenB}
            onSymbolChange={setTokenB}
            disabledSymbol={tokenA}
            amount={amountB}
            onAmountChange={setAmountB}
          />
        </div>

        <div>
          <p className="text-xs text-text-dim mb-2 uppercase tracking-wider">Fee tier</p>
          <FeeTierPicker value={fee} onChange={setFee} />
        </div>

        <div className="text-xs text-text-mute leading-relaxed">
          Initial price: 1 {tokenA} = {ratioLabel(amountA, amountB)} {tokenB}. Hooks: none
          (Phase 5 adds hook selection). Tokens auto-sort to v4 canonical order.
        </div>

        <Button
          variant="primary"
          size="lg"
          disabled={!ready || create.state.status !== "idle"}
          onClick={() => {
            void onSubmit();
          }}
        >
          {ctaLabel(create.state.status, !ready)}
        </Button>

        {create.state.txHash && (
          <a
            href={`${BASESCAN_TX}${create.state.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 justify-center"
          >
            View on BaseScan <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {create.state.status === "success" && create.state.poolKey && (
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              onAddLiquidity({
                tokenA,
                tokenB,
                fee,
                sqrtPriceX96: create.state.poolKey?.sqrtPriceX96 ?? "0",
              });
            }}
          >
            Add liquidity to this pool →
          </Button>
        )}
        {create.state.status === "error" && create.state.error && (
          <p className="text-xs text-red text-center">{create.state.error.message}</p>
        )}
      </div>
    </Card>
  );
}
