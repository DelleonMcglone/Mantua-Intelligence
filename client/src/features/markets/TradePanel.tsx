import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { parseAbi } from "viem";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { api } from "@/lib/api.ts";
import { publicClient, useArcWalletClient } from "@/lib/privy/wallet-client.ts";
import { getSport, type SportId } from "./sports.ts";
import { useSlate } from "./use-slate.ts";

const ERC20 = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const MAX_UINT = 2n ** 256n - 1n;
const EXPLORER = "https://testnet.arcscan.app/tx/";

interface TradeCalldata {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  approvalTarget: `0x${string}` | null;
  inputToken: `0x${string}`;
  marketAddress: `0x${string}`;
  quote: { amountIn: string; amountOut: string; effectivePriceBps: number | null };
}

interface Props {
  sport: SportId;
  eventId: string;
  onClose?: () => void;
}

type Phase =
  | { kind: "idle" }
  | { kind: "quoting" }
  | { kind: "quoted"; calldata: TradeCalldata }
  | { kind: "approving" | "signing" | "confirming"; calldata: TradeCalldata }
  | { kind: "done"; txHash: `0x${string}`; calldata: TradeCalldata }
  | { kind: "error"; message: string };

/**
 * B7-003 / B8-005 groundwork — take a position on one game. Buying a
 * team's YES token with USDC through the market pool: the server quotes
 * and builds calldata (it holds no keys), the USER's wallet signs both the
 * approval and the swap. Effective price ≈ the probability you're paying;
 * a winning YES redeems for exactly 1 USDC after resolution.
 */
export function TradePanel({ sport, eventId, onClose }: Props) {
  const { authenticated } = usePrivy();
  const getWallet = useArcWalletClient();
  const { slates } = useSlate();
  const active = getSport(sport);

  const event = useMemo(
    () => slates[active.id]?.events.find((e) => e.providerEventId === eventId),
    [slates, active.id, eventId],
  );

  const [outcomeIndex, setOutcomeIndex] = useState<0 | 1>(0);
  const [amount, setAmount] = useState("1");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Re-quote whenever the inputs change (debounced).
  useEffect(() => {
    if (!authenticated || !event) return;
    const raw = Math.round(Number(amount) * 1e6);
    const timer = setTimeout(() => {
      if (!Number.isFinite(raw) || raw <= 0) {
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "quoting" });
      api
        .post<TradeCalldata>("/api/markets/trade/calldata", {
          providerEventId: eventId,
          outcomeIndex,
          direction: "buy",
          amountRaw: String(raw),
        })
        .then((calldata) => {
          setPhase({ kind: "quoted", calldata });
        })
        .catch((err: unknown) => {
          setPhase({
            kind: "error",
            message: err instanceof Error ? err.message : "Quote failed",
          });
        });
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [authenticated, event, eventId, outcomeIndex, amount]);

  const execute = async () => {
    if (phase.kind !== "quoted") return;
    const { calldata } = phase;
    try {
      const wallet = await getWallet();
      if (!wallet) throw new Error("No wallet connected");
      const owner = wallet.account.address;

      if (calldata.approvalTarget) {
        const allowance = await publicClient.readContract({
          address: calldata.inputToken,
          abi: ERC20,
          functionName: "allowance",
          args: [owner, calldata.approvalTarget],
        });
        if (allowance < BigInt(calldata.quote.amountIn)) {
          setPhase({ kind: "approving", calldata });
          const approveTx = await wallet.writeContract({
            address: calldata.inputToken,
            abi: ERC20,
            functionName: "approve",
            args: [calldata.approvalTarget, MAX_UINT],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
      }

      setPhase({ kind: "signing", calldata });
      const txHash = await wallet.sendTransaction({
        to: calldata.to,
        data: calldata.data,
        value: BigInt(calldata.value),
      });
      setPhase({ kind: "confirming", calldata });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      setPhase({ kind: "done", txHash, calldata });
      window.dispatchEvent(new Event("mantua:refresh-portfolio"));
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Trade failed" });
    }
  };

  if (!event) {
    return (
      <>
        <PanelHeader />
        <PanelSubHeader title="Trade" {...(onClose ? { onClose } : {})} />
        <p className="px-5 text-[12.5px] text-text-dim">Loading game…</p>
      </>
    );
  }

  const teams = [event.home, event.away] as const;
  const chosen = teams[outcomeIndex];
  const quote = phase.kind === "quoted" || phase.kind === "done" ? phase.calldata.quote : null;
  const yesOut = quote ? Number(quote.amountOut) / 1e6 : null;
  const busy =
    phase.kind === "approving" || phase.kind === "signing" || phase.kind === "confirming";

  return (
    <>
      <PanelHeader />
      <PanelSubHeader
        title={`Trade: ${event.away.abbreviation} @ ${event.home.abbreviation}`}
        subtitle={`${active.label} · pick a side, pay USDC, hold the winner's token`}
        {...(onClose ? { onClose } : {})}
      />
      <div className="flex-1 overflow-auto px-5 pb-6">
        <div className="grid grid-cols-2 gap-2">
          {([0, 1] as const).map((idx) => {
            const team = teams[idx];
            const selected = outcomeIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setOutcomeIndex(idx);
                }}
                className={`rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors cursor-pointer ${
                  selected
                    ? "border-accent/50 bg-accent/10 text-text"
                    : "border-border-soft text-text-dim hover:text-text"
                }`}
              >
                <span className="block font-medium">{team.name}</span>
                <span className="text-[11px] text-text-mute">to win</span>
              </button>
            );
          })}
        </div>

        <label className="mt-4 block text-[11px] font-medium uppercase tracking-wider text-text-mute">
          Spend (USDC)
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
            }}
            inputMode="decimal"
            className="mt-1.5 h-10 w-full rounded-sm border border-border bg-transparent px-3 font-mono text-[14px] text-text outline-none"
          />
        </label>

        <div className="mt-4 rounded-md border border-border-soft px-4 py-3 text-[12.5px] leading-relaxed">
          {phase.kind === "quoting" && <p className="text-text-dim">Quoting…</p>}
          {quote && yesOut !== null && (
            <>
              <p>
                You receive <span className="font-mono">{yesOut.toFixed(2)}</span>{" "}
                <span className="font-medium">{chosen.abbreviation} YES</span>
              </p>
              {quote.effectivePriceBps !== null && (
                <p className="text-text-dim">
                  Effective price {(quote.effectivePriceBps / 100).toFixed(1)}% · pays{" "}
                  <span className="font-mono">{yesOut.toFixed(2)} USDC</span> if {chosen.name} win
                </p>
              )}
            </>
          )}
          {phase.kind === "idle" && !quote && (
            <p className="text-text-dim">Enter an amount to see the live quote.</p>
          )}
          {phase.kind === "error" && <p className="text-yellow">{phase.message}</p>}
          {busy && (
            <p className="text-accent">
              {phase.kind === "approving" && "Approve USDC in your wallet…"}
              {phase.kind === "signing" && "Sign the trade in your wallet…"}
              {phase.kind === "confirming" && "Confirming on-chain…"}
            </p>
          )}
          {phase.kind === "done" && (
            <p className="text-green">
              Position opened.{" "}
              <a
                href={`${EXPLORER}${phase.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View transaction
              </a>
            </p>
          )}
        </div>

        {authenticated ? (
          <Button
            variant="primary"
            size="lg"
            className="mt-4 w-full"
            disabled={phase.kind !== "quoted"}
            onClick={() => {
              void execute();
            }}
          >
            {busy ? "Working…" : `Buy ${chosen.abbreviation} YES`}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="mt-4 w-full"
            onClick={() => {
              window.dispatchEvent(new Event("mantua:open-login"));
            }}
          >
            Log in to trade
          </Button>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-text-mute">
          Trading halts at kickoff. A winning YES token redeems for 1 USDC after the game resolves;
          if the game is postponed or tied, both sides redeem at 0.50. Prices move with the pool —
          large orders move them more.
        </p>
      </div>
    </>
  );
}
