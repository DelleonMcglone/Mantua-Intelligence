import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ARC_TESTNET_CHAIN_ID, getExplorerTxUrl } from "@/lib/chains.ts";
import { useUnifiedBalance } from "./use-unified-balance.ts";

function fmtUsdc(s: string | undefined): string {
  const n = Number(s ?? "0");
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/** "Arc_Testnet" → "Arc Testnet". */
function chainLabel(name: string): string {
  return name.replace(/_/g, " ");
}

/**
 * Unified Balance (Treasury) — the agent wallet's consolidated USDC across
 * chains via Circle Gateway. View + deposit. This is the app's server-side
 * agent wallet (distinct from the user wallet that drives the bridge above).
 */
export function UnifiedBalanceCard() {
  const ub = useUnifiedBalance();
  const [amount, setAmount] = useState("");

  const depositing = ub.depositState.status === "depositing";
  const amountNum = Number(amount);
  const canDeposit = !depositing && Number.isFinite(amountNum) && amountNum > 0;

  const explorerUrl =
    ub.depositState.explorerUrl ??
    (ub.depositState.txHash
      ? getExplorerTxUrl(ARC_TESTNET_CHAIN_ID, ub.depositState.txHash)
      : undefined);

  return (
    <div className="bg-panel-solid border border-border-soft rounded-md p-4 space-y-3">
      <div>
        <div className="text-[13px] font-semibold">Unified Balance</div>
        <div className="text-[11px] text-text-mute mt-0.5">
          Consolidate USDC across chains into one balance, accessible anywhere — reduces the working
          capital you tie up per chain. (Agent treasury · Circle Gateway)
        </div>
      </div>

      {ub.loading && !ub.data && <div className="text-[12px] text-text-dim">Loading balance…</div>}
      {ub.error && <div className="text-[12px] text-red">{ub.error}</div>}

      {ub.data && !ub.data.provisioned && (
        <div className="text-[12px] text-text-dim">
          No agent wallet yet. Open “Create / Manage Agent” to set one up, then deposit USDC here to
          start a unified balance.
        </div>
      )}

      {ub.data?.provisioned && (
        <>
          <div className="bg-bg-elev rounded-sm p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-mute">
              Total unified USDC
            </div>
            <div className="text-[22px] font-mono mt-0.5">{fmtUsdc(ub.data.totalUsdc)}</div>
          </div>

          {ub.data.breakdown && ub.data.breakdown.length > 0 ? (
            <div className="space-y-1">
              {ub.data.breakdown.map((b) => (
                <div key={b.chain} className="flex items-center justify-between text-[12px]">
                  <span className="text-text-dim">{chainLabel(b.chain)}</span>
                  <span className="font-mono">{fmtUsdc(b.amount)} USDC</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-text-mute">
              No funds in the unified balance yet — deposit to get started.
            </div>
          )}

          {/* Deposit */}
          <div className="flex items-center gap-2 pt-1">
            <Input
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
              disabled={depositing}
              className="border border-border-soft bg-bg-elev rounded-sm text-[15px] font-mono px-2 h-9"
            />
            <Button
              variant="primary"
              size="md"
              disabled={!canDeposit}
              onClick={() => {
                void ub.deposit(amount).then(() => {
                  setAmount("");
                });
              }}
            >
              {depositing ? "Depositing…" : "Deposit to unified balance"}
            </Button>
          </div>

          {ub.depositState.status === "error" && ub.depositState.error && (
            <div className="text-[12px] text-red">{ub.depositState.error}</div>
          )}
          {ub.depositState.status === "success" && explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-accent hover:text-accent-2 font-mono"
            >
              Deposit confirmed ↗
            </a>
          )}
        </>
      )}
    </div>
  );
}
