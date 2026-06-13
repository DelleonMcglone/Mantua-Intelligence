import { useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { type BridgeChainKey } from "./appkit.ts";
import {
  type SpendArgs,
  formatUsdc,
  prettyChain,
  useUnifiedBalance,
} from "./use-unified-balance.ts";
import { ChainSelect, Row } from "./shared-ui.tsx";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
type SubTab = "deposit" | "spend";

/**
 * Unified Balance tab — Gateway v1 USDC balance unified across chains.
 * Shows the aggregate balance + per-chain breakdown, and lets the user
 * deposit into and spend from the unified balance.
 */
export function BalanceView({
  authenticated,
  onConnect,
}: {
  authenticated: boolean;
  onConnect: () => void;
}) {
  const ub = useUnifiedBalance();
  const { balances } = ub;
  const [sub, setSub] = useState<SubTab>("deposit");

  // One-shot load when the wallet is connected; refresh is manual after.
  useEffect(() => {
    if (authenticated) void ub.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per auth flip; ub identity changes each render
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div className="flex-1 overflow-auto px-5 pt-2 pb-5">
        <p className="text-[13px] text-text-dim mt-4">
          Connect your wallet to view your unified USDC balance.
        </p>
        <Button variant="primary" size="lg" className="w-full mt-4" onClick={onConnect}>
          Connect wallet
        </Button>
      </div>
    );
  }

  const data = balances.data;
  const chainRows = (data?.breakdown ?? []).flatMap((b) => b.breakdown);

  return (
    <div className="flex-1 overflow-auto px-5 pt-2 pb-5">
      {/* Balance summary */}
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-text-dim">
            Unified USDC balance
          </span>
          <button
            type="button"
            onClick={() => {
              void ub.refresh();
            }}
            aria-label="Refresh balance"
            disabled={balances.status === "loading"}
            className="text-text-dim hover:text-text disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${balances.status === "loading" ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        <div className="text-[30px] font-mono text-text mt-1">
          {balances.status === "loading" && !data ? "…" : formatUsdc(data?.totalConfirmedBalance)}
          <span className="text-[14px] text-text-dim ml-2">USDC</span>
        </div>
        {data?.totalPendingBalance && Number(data.totalPendingBalance) > 0 && (
          <div className="text-[12px] text-amber mt-0.5">
            +{formatUsdc(data.totalPendingBalance)} pending
          </div>
        )}
      </div>

      {/* Per-chain breakdown */}
      {chainRows.length > 0 && (
        <div className="border border-border-soft rounded-md px-4 py-3 mt-3 text-[13px] space-y-1.5">
          {chainRows.map((c) => (
            <Row
              key={c.chain}
              label={prettyChain(c.chain)}
              value={`${formatUsdc(c.confirmedBalance)} USDC`}
              dim
            />
          ))}
        </div>
      )}
      {balances.status === "error" && balances.error && (
        <p className="text-xs text-red mt-3">{balances.error.message}</p>
      )}

      {/* Deposit / Spend sub-tabs */}
      <div className="flex items-center gap-2 mt-4">
        {(["deposit", "spend"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setSub(t);
            }}
            className={`flex-1 py-2 rounded-sm border text-xs font-medium transition-colors ${
              sub === t
                ? "border-accent bg-chip text-text"
                : "border-border-soft bg-bg-elev text-text-dim hover:text-text"
            }`}
          >
            {t === "deposit" ? "Deposit" : "Spend"}
          </button>
        ))}
      </div>

      {sub === "deposit" ? <DepositForm ub={ub} /> : <SpendForm ub={ub} />}
    </div>
  );
}

function DepositForm({ ub }: { ub: ReturnType<typeof useUnifiedBalance> }) {
  const { deposit } = ub;
  const [chain, setChain] = useState<BridgeChainKey>("arc");
  const [amount, setAmount] = useState("");
  const amountNum = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0;
  const busy = deposit.status === "loading";

  return (
    <div className="mt-3">
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">Deposit from</label>
        <ChainSelect
          value={chain}
          onChange={(v) => {
            setChain(v);
            if (deposit.status !== "idle") ub.resetDeposit();
          }}
          id="ub-deposit-chain"
        />
      </div>
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 mt-3">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">Amount (USDC)</label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            if (deposit.status !== "idle") ub.resetDeposit();
          }}
          placeholder="0.0"
          className="w-full bg-transparent border-none outline-none text-[28px] font-mono text-text mt-1"
        />
      </div>

      {deposit.result?.explorerUrl && (
        <a
          href={deposit.result.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 mt-3"
        >
          View deposit transaction <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {deposit.status === "success" && (
        <p className="text-xs text-green mt-3">Deposited into your unified balance.</p>
      )}
      {deposit.status === "error" && deposit.error && (
        <p className="text-xs text-red mt-3">{deposit.error.message}</p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full mt-5"
        disabled={busy || !valid}
        onClick={() => {
          void ub.executeDeposit({ chain, amount: amount.trim() });
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "Depositing…" : "Deposit USDC"}
      </Button>
    </div>
  );
}

function SpendForm({ ub }: { ub: ReturnType<typeof useUnifiedBalance> }) {
  const { spend } = ub;
  const [chain, setChain] = useState<BridgeChainKey>("arc");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [quoteSig, setQuoteSig] = useState<string | null>(null);

  const amountNum = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0;
  // Recipient is optional (defaults to your own address on the destination chain).
  const addressValid = to.trim() === "" || ADDRESS_RE.test(to.trim());
  const ready = amountValid && addressValid;
  const currentSig = `${chain}|${to}|${amount}`;
  const hasQuote = spend.estimate != null && quoteSig === currentSig;
  const busy = spend.status === "loading" || spend.status === "estimating";

  function onChange() {
    if (spend.status !== "idle" || spend.estimate) ub.resetSpend();
    setQuoteSig(null);
  }

  function args(): SpendArgs {
    return { chain, amount: amount.trim(), ...(to.trim() ? { recipient: to.trim() } : {}) };
  }

  async function onPrimary() {
    if (!ready) return;
    if (hasQuote) {
      await ub.executeSpend(args());
    } else {
      const est = await ub.estimateSpend(args());
      if (est) setQuoteSig(currentSig);
    }
  }

  const totalFee = (spend.estimate?.fees ?? []).reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="mt-3">
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">Spend to</label>
        <ChainSelect
          value={chain}
          onChange={(v) => {
            setChain(v);
            onChange();
          }}
          id="ub-spend-chain"
        />
      </div>
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 mt-3">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">
          Recipient (optional)
        </label>
        <input
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            onChange();
          }}
          placeholder="0x… (defaults to your address)"
          spellCheck={false}
          className="w-full bg-transparent border-none outline-none text-[14px] font-mono text-text mt-1"
        />
      </div>
      {!addressValid && <p className="text-xs text-amber mt-1.5">Enter a valid 0x… address.</p>}
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 mt-3">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">Amount (USDC)</label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            onChange();
          }}
          placeholder="0.0"
          className="w-full bg-transparent border-none outline-none text-[28px] font-mono text-text mt-1"
        />
      </div>

      {hasQuote && spend.estimate && (
        <div className="border border-border-soft rounded-md px-4 py-3 mt-3 text-[13px] space-y-1.5">
          {spend.estimate.fees.map((f, i) => (
            <Row
              key={`${f.type}-${String(i)}`}
              label={`Fee · ${f.type}`}
              value={`${f.amount} ${f.token}`}
              dim
            />
          ))}
          <Row label="Total fees" value={`~${totalFee.toFixed(6)} USDC`} />
        </div>
      )}

      {spend.result?.explorerUrl && (
        <a
          href={spend.result.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 mt-3"
        >
          View spend transaction <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {spend.status === "success" && (
        <p className="text-xs text-green mt-3">Spent from your unified balance.</p>
      )}
      {spend.status === "error" && spend.error && (
        <p className="text-xs text-red mt-3">{spend.error.message}</p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full mt-5"
        disabled={busy || !ready}
        onClick={() => {
          void onPrimary();
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {spend.status === "estimating"
          ? "Fetching quote…"
          : spend.status === "loading"
            ? "Spending…"
            : hasQuote
              ? "Confirm spend"
              : "Review spend"}
      </Button>
    </div>
  );
}
