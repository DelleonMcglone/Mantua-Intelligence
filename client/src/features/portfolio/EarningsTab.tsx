/**
 * Earnings tab — the LP's USDC fee-share (a configurable share of swap
 * fees + agent-rebalancing fees, auto-distributed to the connected
 * wallet). Protocol revenue, not emissions: the yield is "fee APR".
 *
 * Layout: hero (fee-share earned for a period, segmented control, Live
 * accrual indicator, fee-APR pill, auto-distribution status, optional
 * "Sweep now") → by-pool breakdown grouped under Base/Arc → recent
 * auto-distributions.
 *
 * Reuses the design system already in `AssetsCard`: the row template,
 * the SHELL_HOOK_TINT palette (`hook-tint.ts`), hairline border-soft
 * dividers, Inter for UI + JetBrains Mono (`font-mono`) for all numerals.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { NetworkLogo } from "@/components/shell/network-icons.tsx";
import { useCurrentChainId } from "@/lib/chain-context.tsx";
import { getExplorerTxUrl } from "@/lib/chains.ts";
import { AssetIcon } from "./asset-icons.tsx";
import { HOOK_TINT } from "./hook-tint.ts";
import {
  EARNINGS_PERIODS,
  PERIOD_LABEL,
  fmtUsd,
  shortenHash,
  totalAccruedUsdc,
  type EarningsData,
  type EarningsNetwork,
  type EarningsPeriod,
  type PoolEarning,
} from "./earnings.ts";

const NETWORK_ORDER: EarningsNetwork[] = ["base", "arc"];
const NETWORK_LABEL: Record<EarningsNetwork, string> = { base: "Base", arc: "Arc" };

/** Mock receipt hash for the optional sweep flow (no fee-distribution
 *  backend on testnet yet — the real tx hash lands when it ships). */
const MOCK_SWEEP_TX = "0x7d3f1a9e0c4b82d65f0a3e7c14b9d8602a5f3e9148c0b7a216df3905ec84b1f0";

export function EarningsTabBody({ data }: { data: EarningsData | null }) {
  const [period, setPeriod] = useState<EarningsPeriod>("TW");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sweepOpen, setSweepOpen] = useState(false);

  if (!data) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-text-dim">
        Connect a wallet to see your fee earnings.
      </div>
    );
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const earned = data.earnedByPeriod[period];

  return (
    <>
      {/* Hero — fee-share earned for the selected period */}
      <div className="px-4 pt-4 pb-4 border-b border-border-soft">
        <div className="text-center">
          <div className="text-[13px] text-text-dim">Fee-share earned</div>
          <div className="text-[34px] font-semibold font-mono mt-0.5 -tracking-[0.02em]">
            {fmtUsd(earned)}
          </div>
          <div className="text-[12px] text-text-mute mt-0.5">USDC · {PERIOD_LABEL[period]}</div>
        </div>

        <div className="flex justify-center items-center gap-3 mt-3">
          <div className="inline-flex bg-bg-elev rounded-full p-[3px] border border-border-soft">
            {EARNINGS_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPeriod(p);
                }}
                className={`px-2.5 py-1 rounded-full border-none text-[12px] font-medium cursor-pointer transition-colors ${
                  period === p ? "bg-chip text-text" : "bg-transparent text-text-dim"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-text-dim text-[12px]">
            <span
              className="w-1.5 h-1.5 rounded-full bg-green"
              style={{ boxShadow: "0 0 8px var(--green)" }}
            />
            Live
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 mt-3.5">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-chip border border-border-soft text-[11px] text-text-dim self-start">
              <span className="font-mono text-green">{data.feeAprPct.toFixed(1)}%</span> fee APR
            </span>
            <div className="flex items-center gap-1.5 text-[12px] text-text-dim min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green flex-shrink-0" />
              <span className="truncate">
                Auto-distributed to{" "}
                <span className="font-mono">{shortenAddr(data.destinationWallet)}</span>
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSweepOpen(true);
            }}
          >
            Sweep now
          </Button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-auto">
        {/* By pool — grouped under Base / Arc */}
        <div className="px-4 pt-3 pb-1 text-[11px] text-text-mute uppercase tracking-wide font-medium">
          By pool
        </div>
        {NETWORK_ORDER.map((net) => {
          const group = data.pools.filter((p) => p.network === net);
          if (group.length === 0) return null;
          return (
            <div key={net}>
              <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5">
                <NetworkLogo network={net} size={14} />
                <span className="text-[11px] text-text-mute uppercase tracking-wide font-medium">
                  {NETWORK_LABEL[net]}
                </span>
              </div>
              {group.map((pool) => (
                <PoolRow
                  key={pool.id}
                  pool={pool}
                  open={expanded.has(pool.id)}
                  onToggle={() => {
                    toggle(pool.id);
                  }}
                />
              ))}
            </div>
          );
        })}

        {/* Recent distributions */}
        <div className="px-4 pt-4 pb-1.5 text-[11px] text-text-mute uppercase tracking-wide font-medium">
          Recent distributions
        </div>
        <RecentDistributions data={data} />
      </div>

      {sweepOpen && (
        <SweepModal
          data={data}
          onClose={() => {
            setSweepOpen(false);
          }}
        />
      )}
    </>
  );
}

function PoolRow({
  pool,
  open,
  onToggle,
}: {
  pool: PoolEarning;
  open: boolean;
  onToggle: () => void;
}) {
  const tint = HOOK_TINT[pool.hook];
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-border-soft bg-transparent border-x-0 border-t-0 text-left cursor-pointer transition-colors hover:bg-row-hover"
      >
        <div className="flex flex-shrink-0">
          <AssetIcon symbol={pool.a} size={26} />
          <div className="-ml-2">
            <AssetIcon symbol={pool.b} size={26} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-[14px]">
              {pool.a} / {pool.b}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-chip text-text-mute border border-border-soft font-mono">
              {pool.fee}
            </span>
          </div>
          <div className="mt-1">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium tracking-[0.02em] inline-block"
              style={{ background: tint.bg, color: tint.fg, border: `1px solid ${tint.bd}` }}
            >
              {pool.hook}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[14px] font-medium font-mono">{fmtUsd(pool.accruedUsdc)}</div>
          {pool.lowVolume ? (
            <div className="text-[12px] text-text-mute">Accruing · low volume</div>
          ) : (
            <div className="text-[12px] font-mono text-green">
              +{pool.feeAprPct.toFixed(1)}% fee APR
            </div>
          )}
        </div>
        <ChevronRight
          className={`h-3.5 w-3.5 text-text-mute transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 py-3 pl-[52px] bg-bg-elev border-b border-border-soft">
          {pool.lowVolume ? (
            <p className="text-[12px] text-text-dim leading-relaxed">
              This pool hasn&apos;t earned a meaningful fee-share yet. Fee APR appears once swap
              volume picks up — no inflated estimate until then.
            </p>
          ) : (
            <dl className="space-y-2">
              <DetailRow label="Swap fees" value={fmtUsd(pool.swapFeesUsdc)} />
              <DetailRow label="Agent-rebalancing fees" value={fmtUsd(pool.agentFeesUsdc)} />
              <DetailRow
                label="LP / protocol split"
                value={`${String(pool.lpSharePct)}% / ${String(pool.protocolSharePct)}%`}
              />
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <dt className="text-text-dim">{label}</dt>
      <dd className="font-mono text-text">{value}</dd>
    </div>
  );
}

function RecentDistributions({ data }: { data: EarningsData }) {
  const chainId = useCurrentChainId();
  if (data.distributions.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[12px] text-text-dim">
        No distributions yet. Fees auto-distribute as they accrue.
      </div>
    );
  }
  return (
    <>
      {data.distributions.map((d) => (
        <div
          key={d.id}
          className="flex items-center justify-between px-4 py-2.5 border-b border-border-soft"
        >
          <div className="min-w-0">
            <div className="text-[13px] text-text">{d.date}</div>
            <a
              href={getExplorerTxUrl(chainId, d.txHash)}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-text-mute hover:text-accent inline-flex items-center gap-1"
            >
              {shortenHash(d.txHash)} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
          <div className="text-[14px] font-mono text-green">+{fmtUsd(d.amountUsdc)}</div>
        </div>
      ))}
    </>
  );
}

function SweepModal({ data, onClose }: { data: EarningsData; onClose: () => void }) {
  const chainId = useCurrentChainId();
  const [status, setStatus] = useState<"review" | "pending" | "done">("review");
  const [txHash, setTxHash] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const pending = totalAccruedUsdc(data);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function confirm() {
    setStatus("pending");
    timer.current = window.setTimeout(() => {
      setTxHash(MOCK_SWEEP_TX);
      setStatus("done");
    }, 900);
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sweep accrued fees</DialogTitle>
          <DialogDescription>
            Earnings auto-distribute to your wallet. Sweeping pulls the pending balance now — it
            isn&apos;t required to claim.
          </DialogDescription>
        </DialogHeader>

        {status === "done" && txHash ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green text-[13px]">
              <Check className="h-4 w-4" /> Sweep submitted
            </div>
            <ModalRow label="Amount" value={fmtUsd(pending)} accent />
            <ModalRow label="Destination" value={shortenAddr(data.destinationWallet)} />
            <a
              href={getExplorerTxUrl(chainId, txHash)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 font-mono"
            >
              {shortenHash(txHash)} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div className="space-y-2.5">
            <ModalRow label="Pending accrued" value={fmtUsd(pending)} accent />
            <ModalRow label="Destination wallet" value={shortenAddr(data.destinationWallet)} />
            <ModalRow label="Network" value={data.networkName} />
            <ModalRow label="Est. gas" value={data.estGas} />
          </div>
        )}

        <DialogFooter>
          {status === "done" ? (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" disabled={status === "pending"} onClick={confirm}>
                {status === "pending" ? "Confirming…" : "Confirm sweep"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModalRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-text-dim">{label}</span>
      <span className={`font-mono ${accent ? "text-green" : "text-text"}`}>{value}</span>
    </div>
  );
}

function shortenAddr(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
