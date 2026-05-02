import { useState, type CSSProperties } from "react";
import { AgentStrip } from "./AgentStrip.tsx";
import {
  Banner,
  BTN_GHOST,
  BTN_PRIMARY,
  DetailRows,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  Spinner,
  TokenChip,
  TxRow,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F3 — `Swap tokens (agent-mode)` from
 * `mantua-ai/project/Mantua Agent Flows.html` (P6-005).
 *
 * State machine: build → hook-pick → review (Stable Protection MODERATE
 * peg-zone ring) → critical-block (CRITICAL peg) → pending → success.
 * Mock data verbatim: 100 USDC → 0.02756 ETH on Dynamic Fee, peg drift
 * 80 bps (MODERATE) and >200 bps (CRITICAL) variants, tx 0x8f4a…c219.
 */

type Step = "build" | "hook" | "review" | "critical" | "pending" | "success";

interface Props {
  onClose: () => void;
}

const AGENT_ADDR = "0x7a3f…bE19";
const TX_HASH = "0x8f4a…c219";

const TITLES: Record<Step, string> = {
  build: "Swap",
  hook: "Choose pool",
  review: "Review swap",
  critical: "Swap blocked",
  pending: "Swapping",
  success: "Swap complete",
};

export function SwapFlow({ onClose }: Props) {
  const [step, setStep] = useState<Step>("build");

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>{TITLES[step]}</div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <AgentStrip
        label={step === "hook" ? "USDC → ETH" : "From agent wallet"}
        addr={step === "hook" ? "100 USDC" : AGENT_ADDR}
        {...(step === "success"
          ? { cap: { text: "$132 / $100 today", tone: "green" as const } }
          : step === "pending" || step === "critical" || step === "hook"
            ? {}
            : { cap: { text: "$32 / $100 today" } })}
      />

      {step === "build" && (
        <BuildStep
          onReview={() => {
            setStep("review");
          }}
          onChoosePool={() => {
            setStep("hook");
          }}
        />
      )}
      {step === "hook" && (
        <HookStep
          onPick={() => {
            setStep("review");
          }}
        />
      )}
      {step === "review" && (
        <ReviewStep
          onEdit={() => {
            setStep("build");
          }}
          onConfirm={() => {
            setStep("pending");
            setTimeout(() => {
              setStep("success");
            }, 1800);
          }}
          onCriticalDemo={() => {
            setStep("critical");
          }}
        />
      )}
      {step === "critical" && (
        <CriticalStep
          onCancel={onClose}
          onAlt={() => {
            setStep("build");
          }}
        />
      )}
      {step === "pending" && <PendingStep />}
      {step === "success" && (
        <SuccessStep
          onAgain={() => {
            setStep("build");
          }}
          onDone={onClose}
        />
      )}
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

const AMOUNT_STYLE: CSSProperties = {
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

const PILL_AMBER: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "1px 6px",
  borderRadius: 99,
  background: "rgba(245,165,36,0.12)",
  color: "var(--amber)",
  border: "1px solid rgba(245,165,36,0.35)",
  fontSize: 10,
};

const PILL_NEUTRAL: CSSProperties = {
  ...PILL_AMBER,
  background: "var(--chip)",
  color: "var(--text-dim)",
  borderColor: "var(--border-soft)",
};

const PILL_ACCENT: CSSProperties = {
  ...PILL_AMBER,
  background: "rgba(139,108,240,0.14)",
  color: "var(--accent)",
  borderColor: "rgba(139,108,240,0.35)",
};

function BuildStep({ onReview, onChoosePool }: { onReview: () => void; onChoosePool: () => void }) {
  return (
    <div style={{ ...PANEL_BODY, gap: 8 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-mute)",
            letterSpacing: ".06em",
            marginBottom: 6,
          }}
        >
          PAY
        </div>
        <div style={TOKEN_INPUT_STYLE}>
          <input style={AMOUNT_STYLE} defaultValue="100.00" />
          <div style={TOKEN_PICK_STYLE}>
            <TokenChip sym="USDC" size={18} /> USDC ▾
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
          Balance: 468.20 USDC · ≈ $100
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", margin: "-2px 0" }}>
        <button type="button" style={{ ...X_CLOSE, borderRadius: 99 }} aria-label="Flip">
          ↓
        </button>
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-mute)",
            letterSpacing: ".06em",
            marginBottom: 6,
          }}
        >
          RECEIVE
        </div>
        <div style={TOKEN_INPUT_STYLE}>
          <input style={AMOUNT_STYLE} defaultValue="0.02756" readOnly />
          <div style={TOKEN_PICK_STYLE}>
            <TokenChip sym="ETH" size={18} /> ETH ▾
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
          ≈ $99.96 · 1 USDC = 0.000275 ETH
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <DetailRows
          rows={[
            { label: "Route", value: "Uniswap v4 · USDC/ETH 0.05%" },
            {
              label: "Hook",
              value: (
                <button
                  type="button"
                  onClick={onChoosePool}
                  style={{ ...PILL_AMBER, cursor: "pointer", padding: "1px 6px" }}
                >
                  Dynamic Fee
                </button>
              ),
            },
            {
              label: "Price impact",
              value: <span style={{ color: "var(--green)" }}>0.04%</span>,
            },
            { label: "Slippage", value: "0.5%" },
          ]}
        />
      </div>

      <button
        type="button"
        style={{ ...BTN_PRIMARY, width: "100%", padding: 12, marginTop: 8 }}
        onClick={onReview}
      >
        Review swap
      </button>
    </div>
  );
}

function HookStep({ onPick }: { onPick: () => void }) {
  return (
    <div style={{ ...PANEL_BODY, gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
        Two pools match this pair on Base Sepolia. Choose how the swap is routed.
      </div>

      <button
        type="button"
        onClick={onPick}
        style={{
          textAlign: "left",
          background: "var(--bg-elev)",
          border: "1px solid var(--accent)",
          borderRadius: 12,
          padding: 12,
          cursor: "pointer",
          color: "var(--text)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={PILL_AMBER}>Dynamic Fee</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>USDC / ETH 0.05%</span>
          <span style={{ ...PILL_ACCENT, marginLeft: "auto" }}>RECOMMENDED</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Fee adjusts based on pool volatility. Currently{" "}
          <b style={{ color: "var(--text)" }}>0.04%</b>. Best output: 0.02756 ETH.
        </div>
      </button>

      <button
        type="button"
        onClick={onPick}
        style={{
          textAlign: "left",
          background: "var(--bg-elev)",
          border: "1px solid var(--border-soft)",
          borderRadius: 12,
          padding: 12,
          cursor: "pointer",
          color: "var(--text)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={PILL_NEUTRAL}>Vanilla v4</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>USDC / ETH 0.30%</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Static 0.30% fee. Output: 0.02744 ETH (-0.4%).
        </div>
      </button>

      <Banner tone="info">
        Hooks are informational here — you can opt out and use the base v4 pool, except for CRITICAL
        peg situations on stable pairs.
      </Banner>
    </div>
  );
}

function PegRing({ filled }: { filled: number }) {
  // 5 zones: healthy / minor / moderate / severe / critical
  const tints = ["#3ddc97", "#d4d058", "#f5a524", "#ff8e3c", "#ff6b6b"];
  return (
    <div style={{ display: "flex", gap: 3, margin: "4px 0 6px" }}>
      {tints.map((tint, i) => (
        <div
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 2,
            background: i < filled ? tint : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

function ReviewStep({
  onEdit,
  onConfirm,
  onCriticalDemo,
}: {
  onEdit: () => void;
  onConfirm: () => void;
  onCriticalDemo: () => void;
}) {
  return (
    <div style={PANEL_BODY}>
      <div
        style={{
          border: "1.5px solid var(--amber)",
          borderRadius: 14,
          padding: 12,
          background: "var(--bg-elev)",
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "var(--amber)",
            letterSpacing: ".1em",
            fontWeight: 600,
            fontFamily: "JetBrains Mono, monospace",
            marginBottom: 6,
          }}
        >
          PEG ZONE: MODERATE
        </div>
        <PegRing filled={3} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <TokenChip sym="USDC" size={26} />
          <span className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
            100 USDC
          </span>
          <span style={{ color: "var(--text-dim)" }}>→</span>
          <TokenChip sym="EURC" size={26} />
          <span className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
            92.30 EURC
          </span>
        </div>
      </div>

      <Banner tone="warn" icon="⚠" title="Pool peg is at risk">
        USDC/EURC has drifted ~80 bps from peg. Stable Protection has raised fees to 0.18% to defend
        the pool. You may experience higher slippage.
      </Banner>

      <DetailRows
        rows={[
          { label: "Pool fee (current)", value: "0.18%" },
          { label: "Min received", value: "91.84 EURC" },
          { label: "Network fee", value: "~ $0.04" },
          { label: "Slippage", value: "0.5%" },
        ]}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onEdit}>
          Edit
        </button>
        <button type="button" style={{ ...BTN_PRIMARY, flex: 2 }} onClick={onConfirm}>
          Confirm swap
        </button>
      </div>

      <button
        type="button"
        onClick={onCriticalDemo}
        style={{
          fontSize: 10,
          color: "var(--text-mute)",
          background: "transparent",
          border: "1px dashed var(--border-soft)",
          borderRadius: 6,
          padding: "4px 8px",
          marginTop: 4,
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        Demo: simulate CRITICAL peg
      </button>
    </div>
  );
}

function CriticalStep({ onCancel, onAlt }: { onCancel: () => void; onAlt: () => void }) {
  return (
    <div style={PANEL_BODY}>
      <div
        style={{
          border: "1.5px solid var(--red)",
          borderRadius: 14,
          padding: 12,
          background: "rgba(255,107,107,0.04)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "var(--red)",
            letterSpacing: ".1em",
            fontWeight: 600,
            fontFamily: "JetBrains Mono, monospace",
            marginBottom: 6,
          }}
        >
          PEG ZONE: CRITICAL
        </div>
        <PegRing filled={5} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
            opacity: 0.6,
          }}
        >
          <TokenChip sym="USDC" size={26} />
          <span className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
            100 USDC
          </span>
          <span style={{ color: "var(--text-dim)" }}>→</span>
          <TokenChip sym="EURC" size={26} />
          <span className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
            — EURC
          </span>
        </div>
      </div>

      <Banner tone="error" icon="⊘" title="Pool peg is critical — swap blocked">
        USDC/EURC has drifted &gt;200 bps from peg. Stable Protection has paused new swaps to
        protect LPs. Try again later, or swap via a different route (USDC → ETH → EURC).
      </Banner>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onAlt}>
          Try different route
        </button>
      </div>
    </div>
  );
}

function PendingStep() {
  return (
    <div style={{ ...PANEL_BODY, alignItems: "center", gap: 14, padding: "30px 20px" }}>
      <Spinner size="lg" agent />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Swapping 100 USDC → ETH</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          Submitted to Base Sepolia · Dynamic Fee hook
        </div>
      </div>
      <TxRow hash={TX_HASH} showCopy={false} />
    </div>
  );
}

function SuccessStep({ onAgain, onDone }: { onAgain: () => void; onDone: () => void }) {
  return (
    <div style={{ ...PANEL_BODY, alignItems: "center", gap: 14, padding: "24px 20px" }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: "rgba(61,220,151,.12)",
          border: "1px solid rgba(61,220,151,.35)",
          color: "var(--green)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        ✓
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TokenChip sym="USDC" size={24} />
        <span className="mono" style={{ fontSize: 14 }}>
          100 USDC
        </span>
        <span style={{ color: "var(--text-dim)" }}>→</span>
        <TokenChip sym="ETH" size={24} />
        <span className="mono" style={{ fontSize: 14 }}>
          0.02756 ETH
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
        Confirmed in 6s · effective fee 0.04%
      </div>
      <TxRow hash={TX_HASH} showCopy={false} />
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onAgain}>
          Swap again
        </button>
        <button type="button" style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
