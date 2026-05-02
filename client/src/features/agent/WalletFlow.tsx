import { useState, type CSSProperties } from "react";
import { AgentStrip } from "./AgentStrip.tsx";
import {
  Banner,
  BigVal,
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  DetailRows,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  Skel,
  Spinner,
  TokenChip,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F1 — `Create & manage agent wallet` from
 * `mantua-ai/project/Mantua Agent Flows.html` (P6-003).
 *
 * State machine: empty → provisioning → unfunded → funding → funded
 * → withdraw. Mock data (`0x7a3f…bE19` agent / `0x9f12…aE7d` user /
 * 468.20 USDC / 0.008 ETH / $32 of $100 daily) is verbatim from the
 * design. Real CDP wiring lands when this flow ships in production
 * (P6-003); for pass 1 it stays presentational.
 */

type Step =
  | "empty"
  | "provisioning"
  | "unfunded"
  | "funding"
  | "funded"
  | "withdraw"
  | "err-create"
  | "err-insufficient"
  | "err-cap";

interface Props {
  onClose: () => void;
}

const AGENT_ADDR = "0x7a3f…bE19";
const USER_ADDR = "0x9f12…aE7d";

export function WalletFlow({ onClose }: Props) {
  const [step, setStep] = useState<Step>("empty");

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>
          <span style={{ fontSize: 14 }}>🤖</span>
          {step === "funding"
            ? "Fund agent"
            : step === "withdraw"
              ? "Withdraw to my wallet"
              : "Agent wallet"}
        </div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {step === "empty" && (
        <EmptyState
          onCreate={() => {
            setStep("provisioning");
          }}
        />
      )}
      {step === "provisioning" && (
        <ProvisioningState
          onCancel={() => {
            setStep("empty");
          }}
          onDone={() => {
            setStep("unfunded");
          }}
        />
      )}
      {step === "unfunded" && (
        <UnfundedState
          onFund={() => {
            setStep("funding");
          }}
        />
      )}
      {step === "funding" && (
        <FundingState
          onCancel={() => {
            setStep("unfunded");
          }}
          onConfirm={() => {
            setStep("funded");
          }}
        />
      )}
      {step === "funded" && (
        <FundedState
          onAddFunds={() => {
            setStep("funding");
          }}
          onWithdraw={() => {
            setStep("withdraw");
          }}
        />
      )}
      {step === "withdraw" && (
        <WithdrawState
          onCancel={() => {
            setStep("funded");
          }}
          onConfirm={() => {
            setStep("unfunded");
          }}
        />
      )}
    </>
  );
}

const HEX_GLYPH: CSSProperties = {
  width: 84,
  height: 84,
};

function HexAgent() {
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" fill="none" style={HEX_GLYPH}>
      <path
        d="M42 4 L74 22 L74 62 L42 80 L10 62 L10 22 Z"
        stroke="#4cc6c6"
        strokeWidth="1.5"
        opacity=".35"
      />
      <path
        d="M42 14 L66 28 L66 56 L42 70 L18 56 L18 28 Z"
        stroke="#4cc6c6"
        strokeWidth="1.5"
        opacity=".6"
      />
      <circle cx="42" cy="42" r="8" fill="#4cc6c6" opacity=".25" />
      <circle cx="42" cy="42" r="3.5" fill="#4cc6c6" />
    </svg>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        ...PANEL_BODY,
        alignItems: "center",
        textAlign: "center",
        gap: 14,
        justifyContent: "center",
      }}
    >
      <HexAgent />
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.01em" }}>
          No agent wallet yet
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-dim)",
            marginTop: 6,
            maxWidth: 280,
            lineHeight: 1.55,
          }}
        >
          An agent wallet is a separate CDP-managed wallet on Base Sepolia that takes actions on
          your behalf, within a spending cap you set.
        </div>
      </div>
      <button type="button" style={{ ...BTN_PRIMARY, minWidth: 200 }} onClick={onCreate}>
        Create agent wallet
      </button>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-mute)",
          maxWidth: 300,
          lineHeight: 1.5,
        }}
      >
        You'll fund it from your primary wallet in the next step. Mantua never gets keys to your
        primary wallet.
      </div>
    </div>
  );
}

function ProvisioningState({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  // Auto-advance the demo after the skeleton settles. Real CDP call
  // wires here under P6-003.
  setTimeout(onDone, 1800);
  return (
    <div
      style={{
        ...PANEL_BODY,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
      }}
    >
      <Spinner size="lg" agent />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Provisioning agent wallet</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          on Base Sepolia · CDP-signed
        </div>
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: 300,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 6,
        }}
      >
        <Skel height={10} />
        <Skel height={10} width="80%" />
        <Skel height={10} width="55%" />
      </div>
      <button
        type="button"
        style={{ ...BTN_GHOST, padding: "6px 10px", fontSize: 11, marginTop: 10 }}
        onClick={onCancel}
      >
        Cancel
      </button>
      <div style={{ fontSize: 10, color: "var(--text-mute)" }}>
        CDP wallet creation is async — cancel is safe.
      </div>
    </div>
  );
}

function UnfundedState({ onFund }: { onFund: () => void }) {
  return (
    <>
      <AgentStrip
        label="Agent wallet"
        addr={
          <>
            {AGENT_ADDR} <a style={{ color: "var(--text-dim)", marginLeft: 4 }}>↗</a>
          </>
        }
        cap={{ text: "unfunded" }}
      />
      <div style={PANEL_BODY}>
        <BigVal
          label="BALANCE"
          value="0.0 ETH"
          sub="≈ $0.00 · no other tokens"
          padding="18px 12px"
        />
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={onFund}
            style={{ ...BTN_PRIMARY, width: "100%", padding: 12 }}
          >
            Fund agent
          </button>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            Funds move from <b style={{ color: "var(--text)" }}>your wallet → agent wallet</b>. You
            set the amount and a spending cap. The agent can only spend within that cap.
          </div>
        </div>
        <hr
          style={{ border: "none", borderTop: "1px solid var(--border-soft)", margin: "18px 0" }}
        />
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: 11,
            color: "var(--text-dim)",
          }}
        >
          <span>View on</span>
          <a style={{ color: "var(--text-dim)", cursor: "pointer" }}>BaseScan ↗</a>
          <span style={{ marginLeft: "auto" }}>
            <a style={{ color: "var(--text-dim)", cursor: "pointer" }}>Copy ⎘</a>
          </span>
        </div>
      </div>
    </>
  );
}

const TOKEN_INPUT_STYLE: CSSProperties = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const AMOUNT_INPUT_STYLE: CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 22,
  fontWeight: 500,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--text)",
  minWidth: 0,
  flex: 1,
};

const TOKEN_PICK_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 99,
  background: "var(--chip)",
  border: "1px solid var(--border-soft)",
  cursor: "pointer",
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text)",
};

function FundingState({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [amount, setAmount] = useState("500.00");
  const [cap, setCap] = useState("100.00");
  return (
    <>
      <AgentStrip label="Sending to" addr={AGENT_ADDR} cap={{ text: "cap: not set" }} />
      <div style={PANEL_BODY}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-mute)",
              letterSpacing: ".06em",
              marginBottom: 6,
            }}
          >
            FROM YOUR WALLET
          </div>
          <div style={TOKEN_INPUT_STYLE}>
            <input
              style={AMOUNT_INPUT_STYLE}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
            />
            <div style={TOKEN_PICK_STYLE}>
              <TokenChip sym="USDC" size={18} /> USDC ▾
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-dim)",
              marginTop: 6,
            }}
          >
            <span>Balance: 7,292.36</span>
            <button
              type="button"
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(139,108,240,.14)",
                color: "var(--accent)",
                border: "1px solid rgba(139,108,240,.35)",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              MAX
            </button>
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-mute)",
              letterSpacing: ".06em",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>SPENDING CAP · DAILY</span>
            <span style={{ color: "var(--text-dim)", textTransform: "none", letterSpacing: 0 }}>
              how much the agent can spend per day
            </span>
          </div>
          <div style={TOKEN_INPUT_STYLE}>
            <input
              style={{ ...AMOUNT_INPUT_STYLE, fontSize: 18 }}
              value={cap}
              onChange={(e) => {
                setCap(e.target.value);
              }}
            />
            <div style={{ ...TOKEN_PICK_STYLE, fontSize: 12 }}>USDC / day ▾</div>
          </div>
        </div>

        <Banner tone="info" title="Resulting state">
          Agent will receive <b>{amount} USDC</b> and may spend up to <b>{cap} USDC / day</b>. Cap
          resets every 24h. You can adjust at any time.
        </Banner>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" style={{ ...BTN_PRIMARY, flex: 2 }} onClick={onConfirm}>
            Confirm &amp; fund
          </button>
        </div>
      </div>
    </>
  );
}

function FundedState({
  onAddFunds,
  onWithdraw,
}: {
  onAddFunds: () => void;
  onWithdraw: () => void;
}) {
  return (
    <>
      <AgentStrip
        label="Agent wallet"
        addr={
          <>
            {AGENT_ADDR} <a style={{ color: "var(--text-dim)", marginLeft: 4 }}>↗</a>
          </>
        }
        cap={{ text: "$32 / $100 daily", tone: "green" }}
      />
      <div style={{ ...PANEL_BODY, padding: 0 }}>
        <div style={{ padding: 14 }}>
          <BigVal
            label="TOTAL VALUE"
            value="$497.28"
            sub={
              <>
                Spending cap: <b style={{ color: "var(--green)" }}>$68 remaining</b> · resets in 14h
                22m
              </>
            }
            padding="14px 12px"
          />
        </div>
        <div style={{ borderTop: "1px solid var(--border-soft)" }}>
          <AssetRow sym="USDC" name="USDC" sub="468.20 · $1.00" amt="$468.20" />
          <AssetRow sym="ETH" name="ETH" sub="0.008 · $3,630.12" amt="$29.04" />
          <AssetRow sym="EURC" name="EURC" sub="0.04 · $1.08" amt="$0.04" />
        </div>
        <div
          style={{
            padding: 14,
            display: "flex",
            gap: 8,
            borderTop: "1px solid var(--border-soft)",
          }}
        >
          <button type="button" style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onAddFunds}>
            Add funds
          </button>
          <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onWithdraw}>
            Withdraw
          </button>
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          <a
            style={{
              fontSize: 11,
              color: "var(--accent)",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            View all agent transactions →
          </a>
        </div>
      </div>
    </>
  );
}

function AssetRow({
  sym,
  name,
  sub,
  amt,
}: {
  sym: string;
  name: string;
  sub: string;
  amt: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <TokenChip sym={sym} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>{sub}</div>
      </div>
      <div className="mono" style={{ textAlign: "right", fontSize: 13 }}>
        {amt}
      </div>
    </div>
  );
}

function WithdrawState({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <AgentStrip label="Withdrawing from" addr={AGENT_ADDR} />
      <div style={PANEL_BODY}>
        <Banner tone="warn" icon="⚠" title="Withdraw all agent funds?">
          All tokens move back to your primary wallet ({USER_ADDR}). The agent will be unable to act
          until refunded.
        </Banner>

        <div
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--border-soft)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-mute)",
              letterSpacing: ".06em",
              marginBottom: 8,
            }}
          >
            YOU WILL RECEIVE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { sym: "USDC", amt: "468.20" },
              { sym: "ETH", amt: "0.008" },
              { sym: "EURC", amt: "0.04" },
            ].map((r) => (
              <div
                key={r.sym}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <TokenChip sym={r.sym} size={18} /> {r.sym}
                </span>
                <span className="mono">{r.amt}</span>
              </div>
            ))}
          </div>
        </div>

        <DetailRows
          rows={[
            { label: "Estimated gas", value: "~ $0.04 (3 txs)" },
            { label: "To", value: USER_ADDR },
            { label: "Network", value: "Base Sepolia" },
          ]}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" style={{ ...BTN_DANGER, flex: 2 }} onClick={onConfirm}>
            Withdraw all
          </button>
        </div>
      </div>
    </>
  );
}
