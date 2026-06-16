/**
 * Earnings tab — a position's REAL uncollected swap fees, read live from v4
 * on-chain state (`GET /api/earnings`). No fabricated numbers: the hero shows
 * the true total claimable, each row shows a position's actual accrued token
 * amounts, and "Sweep" sends a real `collect` tx. Empty / $0 until liquidity
 * earns fees.
 */

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useCurrentChainId } from "@/lib/chain-context.tsx";
import { getExplorerTxUrl } from "@/lib/chains.ts";
import { fmtToken, fmtUsd, shortenHash, type EarningPosition } from "./earnings.ts";
import type { UseEarnings } from "./use-earnings.ts";
import { useSweep } from "./use-sweep.ts";

function shortenAddr(a: string): string {
  return a.length <= 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function EarningsTabBody({
  earnings,
  walletAddress,
}: {
  earnings: UseEarnings;
  walletAddress: string | null;
}) {
  const [sweepOpen, setSweepOpen] = useState(false);
  const { data, loading, error, refetch } = earnings;

  if (!walletAddress) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-text-dim">
        Connect a wallet to see your fee earnings.
      </div>
    );
  }
  if (loading && !data) {
    return <div className="px-4 py-8 text-center text-[12px] text-text-dim">Reading fees…</div>;
  }
  if (error) {
    return <div className="px-4 py-8 text-center text-[12px] text-red">{error}</div>;
  }

  const total = data?.totalAccruedUsd ?? 0;
  const positions = data?.positions ?? [];
  const withFees = positions.filter(
    (p) => p.accrued0Human > 0 || p.accrued1Human > 0 || p.accruedUsd > 0,
  );

  return (
    <>
      {/* Hero — total uncollected fees (real, on-chain) */}
      <div className="px-4 pt-4 pb-4 border-b border-border-soft">
        <div className="text-center">
          <div className="text-[13px] text-text-dim">Uncollected fees</div>
          <div className="text-[34px] font-semibold font-mono mt-0.5 -tracking-[0.02em]">
            {fmtUsd(total)}
          </div>
          <div className="text-[12px] text-text-mute mt-0.5">
            {positions.length === 0
              ? "Arc Testnet"
              : `across ${String(positions.length)} position${positions.length > 1 ? "s" : ""} · Arc Testnet`}
          </div>
        </div>
        <div className="flex justify-center mt-3">
          <Button
            variant="primary"
            disabled={positions.length === 0}
            onClick={() => {
              setSweepOpen(true);
            }}
          >
            Sweep accrued fees
          </Button>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-text-dim">
          No positions yet. Add liquidity to a pool to start earning swap fees — they accrue here as
          others trade through it.
        </div>
      ) : (
        <div className="px-2 py-2">
          {withFees.length === 0 && (
            <div className="px-2 pb-2 text-[11px] text-text-mute">
              Your {positions.length === 1 ? "position hasn't" : "positions haven't"} accrued fees
              yet — fees build up as swaps run through the pool.
            </div>
          )}
          {positions.map((p) => (
            // tokenIds collide across per-hook PositionManagers, so key on
            // hook + tokenId to keep duplicate ids distinct.
            <PositionRow key={`${p.hookAddress ?? "none"}-${p.tokenId}`} p={p} />
          ))}
        </div>
      )}

      {sweepOpen && (
        <SweepModal
          walletAddress={walletAddress}
          onClose={() => {
            setSweepOpen(false);
            refetch();
          }}
        />
      )}
    </>
  );
}

function PositionRow({ p }: { p: EarningPosition }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-2.5 rounded-md hover:bg-row-hover">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">
          {p.sym0} / {p.sym1}
        </div>
        <div className="text-[11px] text-text-mute font-mono mt-0.5">
          {fmtToken(p.accrued0Human)} {p.sym0} · {fmtToken(p.accrued1Human)} {p.sym1}
        </div>
      </div>
      <div className="text-[13px] font-mono text-green">{fmtUsd(p.accruedUsd)}</div>
    </div>
  );
}

function SweepModal({ walletAddress, onClose }: { walletAddress: string; onClose: () => void }) {
  const chainId = useCurrentChainId();
  const sweep = useSweep();
  const { status, txHash, sweptCount } = sweep.state;
  const busy = status === "preparing" || status === "signing" || status === "pending";

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
            Collects the swap fees your open positions have accrued on-chain and sends them to your
            wallet.
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green text-[13px]">
              <Check className="h-4 w-4" /> Fees collected
              {sweptCount ? ` from ${String(sweptCount)} position${sweptCount > 1 ? "s" : ""}` : ""}
            </div>
            <ModalRow label="Destination" value={shortenAddr(walletAddress)} />
            {txHash && (
              <a
                href={getExplorerTxUrl(chainId, txHash)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 font-mono"
              >
                {shortenHash(txHash)} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : status === "empty" ? (
          <p className="text-[13px] text-text-dim">
            No accrued fees to collect yet. Add liquidity and let some swaps run through your pools,
            then sweep.
          </p>
        ) : status === "error" ? (
          <p className="text-[13px] text-red">{sweep.state.error?.message ?? "Sweep failed."}</p>
        ) : (
          <div className="space-y-2.5">
            <ModalRow label="Destination wallet" value={shortenAddr(walletAddress)} />
            <ModalRow label="Network" value="Arc Testnet" />
            <p className="text-[12px] text-text-mute pt-0.5">
              You&apos;ll confirm one collect transaction per position in your wallet.
            </p>
          </div>
        )}

        <DialogFooter>
          {status === "success" || status === "empty" ? (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          ) : status === "error" ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button variant="primary" onClick={sweep.reset}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => {
                  void sweep.execute();
                }}
              >
                {busy ? "Collecting…" : "Confirm sweep"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-text-dim">{label}</span>
      <span className="font-mono text-text">{value}</span>
    </div>
  );
}
