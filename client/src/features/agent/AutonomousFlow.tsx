import { useState } from "react";
import { AgentStrip } from "./AgentStrip.tsx";
import { IntentCard } from "./IntentCard.tsx";
import {
  BTN_GHOST,
  BTN_PRIMARY,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  Spinner,
  TokenChip,
  TxRow,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F7 — `Autonomous mode` from
 * `mantua-ai/project/Mantua Agent Flows.html` (P6-009).
 *
 * Per design: this panel does NOT host its own composer. Instructions
 * arrive from the F8 ⌘K command bar (pass 2). For pass 1 the example
 * chips pre-fill a stub instruction so the rest of the flow can be
 * driven without F8.
 *
 * State machine: idle → parsing → confirm → executing → done.
 * Plus three error variants: low-conf clarification, failed-parse,
 * cap-exceeded.
 */

type Step =
  | "idle"
  | "parsing"
  | "confirm"
  | "executing"
  | "done"
  | "low-conf"
  | "failed"
  | "cap-exceeded";

interface Props {
  onClose: () => void;
}

const AGENT_ADDR = "0x7a3f…bE19";
const TX_HASH = "0x8f4a…c219";

export function AutonomousFlow({ onClose }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [instr, setInstr] = useState("Swap 10 USDC for ETH");

  function fillInstr(text: string) {
    setInstr(text);
    setStep("parsing");
    setTimeout(() => {
      const lower = text.toLowerCase();
      if (lower.includes("poem") || lower.includes("tell me")) {
        setStep("failed");
      } else if (lower.includes("good pool") || lower.includes("some money")) {
        setStep("low-conf");
      } else if (/\b\d{3,}\b/.test(lower) && lower.includes("usdc")) {
        setStep("cap-exceeded");
      } else {
        setStep("confirm");
      }
    }, 1500);
  }

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>Autonomous mode</div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <AgentStrip
        label="Agent wallet"
        addr={AGENT_ADDR}
        {...(step === "idle"
          ? { cap: { text: "$68 cap left" } }
          : step === "confirm"
            ? { cap: { text: "$68 left" } }
            : step === "done"
              ? { cap: { text: "$58 left", tone: "green" as const } }
              : step === "cap-exceeded"
                ? { cap: { text: "$0 left", tone: "red" as const } }
                : {})}
      />

      {step === "idle" && <IdleStep onPick={fillInstr} />}
      {step === "parsing" && <ParsingStep instr={instr} />}
      {step === "confirm" && (
        <ConfirmStep
          instr={instr}
          onCancel={() => {
            setStep("idle");
          }}
          onConfirm={() => {
            setStep("executing");
            setTimeout(() => {
              setStep("done");
            }, 2200);
          }}
        />
      )}
      {step === "executing" && <ExecutingStep instr={instr} />}
      {step === "done" && <DoneStep instr={instr} />}
      {step === "low-conf" && <LowConfidenceStep instr={instr} />}
      {step === "failed" && <FailedStep instr={instr} onChip={fillInstr} />}
      {step === "cap-exceeded" && <CapExceededStep instr={instr} />}
    </>
  );
}

const INSTR_BOX_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-dim)",
  padding: "8px 12px",
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
};

const STEP_BOX_STYLE: React.CSSProperties = {
  padding: 14,
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
};

const CHIP_STYLE: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 99,
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  color: "var(--text-dim)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

function IdleStep({ onPick }: { onPick: (s: string) => void }) {
  const examples = [
    "Swap 10 USDC for ETH",
    "Add liquidity to USDC/EURC",
    "Send 5 USDC to vitalik.eth",
  ];
  return (
    <div style={{ ...PANEL_BODY, gap: 14 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 10,
          padding: "24px 0",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "var(--agent-dim)",
            border: "1px solid var(--agent-bd)",
            color: "var(--agent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          ⌘
        </div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Use the command bar</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", maxWidth: 280 }}>
          Type any instruction into the ⌘K bar at the top. Parsed plans appear here for your
          confirmation.
        </div>
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
          EXAMPLES
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {examples.map((e) => (
            <button
              key={e}
              type="button"
              style={CHIP_STYLE}
              onClick={() => {
                onPick(e);
              }}
            >
              {e}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 8 }}>
          Chips pre-fill the command bar.
        </div>
      </div>
    </div>
  );
}

function ParsingStep({ instr }: { instr: string }) {
  return (
    <div style={{ ...PANEL_BODY, gap: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
        INSTRUCTION FROM ⌘K
      </div>
      <div style={{ ...INSTR_BOX_STYLE, fontSize: 14, color: "var(--text)" }}>{instr}</div>
      <div style={STEP_BOX_STYLE}>
        <div
          style={{
            fontSize: 11,
            color: "var(--amber)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <Spinner size="sm" agent /> Parsing instruction…
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          <div style={{ display: "flex", gap: 8, color: "var(--text-dim)", alignItems: "center" }}>
            <span style={{ color: "var(--green)", width: 12 }}>✓</span> Recognized intent: SWAP
          </div>
          <div style={{ display: "flex", gap: 8, color: "var(--text-dim)", alignItems: "center" }}>
            <span style={{ color: "var(--green)", width: 12 }}>✓</span> Identified tokens: USDC →
            ETH
          </div>
          <div style={{ display: "flex", gap: 8, color: "var(--text-mute)", alignItems: "center" }}>
            <span style={{ color: "var(--text-mute)", width: 12 }}>·</span> Quoting best route…
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({
  instr,
  onCancel,
  onConfirm,
}: {
  instr: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={PANEL_BODY}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
        INSTRUCTION FROM ⌘K
      </div>
      <div style={INSTR_BOX_STYLE}>{instr}</div>
      <div style={{ fontSize: 11, color: "var(--green)", marginTop: 4 }}>
        ✓ Parsed · awaiting your confirmation
      </div>
      <IntentCard
        confidence="high"
        headlineRight="confidence: high"
        what={
          <>
            <TokenChip sym="USDC" size={24} />
            <span>Swap 10 USDC → ETH</span>
          </>
        }
        rows={[
          { label: "Estimated output", value: <span className="mono">0.00276 ETH</span> },
          { label: "Slippage", value: <span className="mono">0.5%</span> },
          {
            label: "Hook",
            value: (
              <span
                style={{
                  display: "inline-block",
                  padding: "1px 5px",
                  borderRadius: 99,
                  fontSize: 10,
                  background: "rgba(245,165,36,0.12)",
                  color: "var(--amber)",
                  border: "1px solid rgba(245,165,36,0.35)",
                }}
              >
                Dynamic Fee
              </span>
            ),
          },
          {
            label: "Cap impact",
            value: (
              <span className="mono" style={{ color: "var(--green)" }}>
                $58 left after
              </span>
            ),
          },
        ]}
        actions={
          <>
            <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" style={{ ...BTN_PRIMARY, flex: 2 }} onClick={onConfirm}>
              Confirm &amp; execute
            </button>
          </>
        }
      />
      <div style={{ fontSize: 10, color: "var(--text-mute)" }}>
        Confirmation is required, even at high confidence (PN-010).
      </div>
    </div>
  );
}

function ExecutingStep({ instr }: { instr: string }) {
  return (
    <div style={PANEL_BODY}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
        INSTRUCTION
      </div>
      <div style={INSTR_BOX_STYLE}>{instr}</div>
      <div style={STEP_BOX_STYLE}>
        <div style={{ fontSize: 11, color: "var(--green)", marginBottom: 10 }}>
          ✓ Confirmed · executing
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          {["Quote locked", "Spending cap check passed", "Submitted to Base Sepolia"].map((s) => (
            <div
              key={s}
              style={{
                display: "flex",
                gap: 8,
                color: "var(--text-dim)",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--green)", width: 12 }}>✓</span> {s}
            </div>
          ))}
          <div
            style={{
              display: "flex",
              gap: 8,
              color: "var(--text-mute)",
              alignItems: "center",
            }}
          >
            <Spinner size="sm" agent /> Waiting for confirmation…
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <TxRow hash={TX_HASH} showCopy={false} />
        </div>
      </div>
    </div>
  );
}

function DoneStep({ instr }: { instr: string }) {
  return (
    <div style={PANEL_BODY}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
        INSTRUCTION
      </div>
      <div style={INSTR_BOX_STYLE}>{instr}</div>
      <div style={STEP_BOX_STYLE}>
        <div style={{ fontSize: 11, color: "var(--green)", marginBottom: 6 }}>✓ Done · 6.2s</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Swapped 10 USDC for 0.00276 ETH</div>
        <div style={{ marginTop: 10 }}>
          <TxRow hash={TX_HASH} showCopy={false} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-mute)" }}>
        For another action, type into the ⌘K command bar.
      </div>
    </div>
  );
}

function LowConfidenceStep({ instr }: { instr: string }) {
  return (
    <div style={PANEL_BODY}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
        INSTRUCTION FROM ⌘K
      </div>
      <div style={INSTR_BOX_STYLE}>{instr}</div>
      <div
        style={{
          ...STEP_BOX_STYLE,
          border: "1px solid rgba(245,165,36,0.30)",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--amber)", marginBottom: 6 }}>⚠ Low confidence</div>
        <div style={{ fontSize: 13 }}>Did you mean one of these?</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 10,
          }}
        >
          {[
            "→ Add liquidity to USDC/ETH 0.05% (your highest-APR pool)",
            "→ Add liquidity to USDC/EURC (Stable Protection)",
            "→ Something else…",
          ].map((s) => (
            <button
              key={s}
              type="button"
              style={{
                ...BTN_GHOST,
                justifyContent: "flex-start",
                padding: "9px 11px",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FailedStep({ instr, onChip }: { instr: string; onChip: (s: string) => void }) {
  return (
    <div style={PANEL_BODY}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
        INSTRUCTION FROM ⌘K
      </div>
      <div style={INSTR_BOX_STYLE}>{instr}</div>
      <div
        style={{
          ...STEP_BOX_STYLE,
          border: "1px solid rgba(255,107,107,0.30)",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 6 }}>⊘ Couldn't parse</div>
        <div style={{ fontSize: 13 }}>I handle on-chain actions only. Try one of these:</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {["Swap 10 USDC for ETH", "Add liquidity to USDC/EURC", "Send 5 USDC to vitalik.eth"].map(
            (c) => (
              <button
                key={c}
                type="button"
                style={CHIP_STYLE}
                onClick={() => {
                  onChip(c);
                }}
              >
                {c}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function CapExceededStep({ instr }: { instr: string }) {
  return (
    <div style={PANEL_BODY}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
        INSTRUCTION FROM ⌘K
      </div>
      <div style={INSTR_BOX_STYLE}>{instr}</div>
      <div
        style={{
          ...STEP_BOX_STYLE,
          border: "1px solid rgba(255,107,107,0.30)",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 6 }}>⊘ Can't execute</div>
        <div style={{ fontSize: 13 }}>
          Your agent's daily cap would be exceeded. <b>$68 remaining</b>, this swap is $200.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" style={{ ...BTN_GHOST, padding: "6px 10px", fontSize: 11 }}>
            Try $50 instead
          </button>
          <button type="button" style={{ ...BTN_PRIMARY, padding: "6px 10px", fontSize: 11 }}>
            Adjust cap
          </button>
        </div>
      </div>
    </div>
  );
}
