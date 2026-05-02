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
 * F2 — `Send tokens` from
 * `mantua-ai/project/Mantua Agent Flows.html` (P6-004).
 *
 * State machine: recipient → amount → review → pending → success.
 * Mock data verbatim from the design (vitalik.eth → 0xd8dA…6045,
 * 5.00 USDC, $5 cap impact, $63 remaining after, tx 0x4f2a…c19b).
 */

type Step = "recipient" | "amount" | "review" | "pending" | "success";

interface Props {
  onClose: () => void;
}

const AGENT_ADDR = "0x7a3f…bE19";
const RESOLVED_ADDR = "0xd8dA…6045";
const FULL_RESOLVED = "0xd8dA6Bf26964aF9D7eEd9e03E53415D37aA96045";
const TX_HASH = "0x4f2a…c19b";

const TITLES: Record<Step, string> = {
  recipient: "Send",
  amount: "Send",
  review: "Review send",
  pending: "Sending",
  success: "Sent",
};

export function SendFlow({ onClose }: Props) {
  const [step, setStep] = useState<Step>("recipient");
  const [recipient, setRecipient] = useState("vitalik.eth");
  const [amount, setAmount] = useState("5.00");

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>{TITLES[step]}</div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <AgentStrip
        label="From agent wallet"
        addr={AGENT_ADDR}
        {...(step === "success"
          ? { cap: { text: "$37 / $100 today", tone: "green" as const } }
          : step === "pending"
            ? {}
            : { cap: { text: "$32 / $100 today" } })}
      />

      {step === "recipient" && (
        <RecipientStep
          value={recipient}
          onChange={setRecipient}
          onContinue={() => {
            setStep("amount");
          }}
        />
      )}
      {step === "amount" && (
        <AmountStep
          recipient={recipient}
          amount={amount}
          onAmountChange={setAmount}
          onEdit={() => {
            setStep("recipient");
          }}
          onReview={() => {
            setStep("review");
          }}
        />
      )}
      {step === "review" && (
        <ReviewStep
          amount={amount}
          onEdit={() => {
            setStep("amount");
          }}
          onConfirm={() => {
            setStep("pending");
            setTimeout(() => {
              setStep("success");
            }, 1800);
          }}
        />
      )}
      {step === "pending" && <PendingStep amount={amount} />}
      {step === "success" && (
        <SuccessStep
          amount={amount}
          onAgain={() => {
            setStep("recipient");
          }}
          onDone={onClose}
        />
      )}
    </>
  );
}

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

const ADDR_CHIP_STYLE: CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 6,
  background: "var(--chip)",
  border: "1px solid var(--border-soft)",
  color: "var(--text-dim)",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const ADDR_CHIP_GREEN: CSSProperties = {
  ...ADDR_CHIP_STYLE,
  color: "var(--green)",
  borderColor: "rgba(61,220,151,0.35)",
  background: "rgba(61,220,151,0.08)",
};

function RecipientStep({
  value,
  onChange,
  onContinue,
}: {
  value: string;
  onChange: (s: string) => void;
  onContinue: () => void;
}) {
  return (
    <div style={PANEL_BODY}>
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
          <span>RECIPIENT</span>
          <button
            type="button"
            style={{
              ...BTN_GHOST,
              padding: "2px 8px",
              fontSize: 10,
            }}
          >
            ⚏ Scan QR
          </button>
        </div>
        <input
          style={INPUT_STYLE}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder="0x… or vitalik.eth"
        />
        <div
          style={{
            fontSize: 11,
            color: "var(--green)",
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ✓ Resolved ·{" "}
          <span className="mono" style={{ color: "var(--text-dim)" }}>
            {RESOLVED_ADDR}
          </span>
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-mute)",
            letterSpacing: ".06em",
            marginBottom: 8,
          }}
        >
          RECENT
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { addr: "0x9f12…aE7d", note: "my main · 2d ago" },
            { addr: "0xb14a…21cf", note: "5d ago" },
            { addr: "0xc7e0…77ab", note: "1w ago" },
          ].map((r) => (
            <button
              key={r.addr}
              type="button"
              style={{
                ...ADDR_CHIP_STYLE,
                display: "flex",
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              <span style={{ flex: 1 }}>{r.addr}</span>
              <span style={{ color: "var(--text-mute)" }}>{r.note}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        style={{ ...BTN_PRIMARY, width: "100%", padding: 12 }}
        onClick={onContinue}
      >
        Continue
      </button>
    </div>
  );
}

function AmountStep({
  recipient,
  amount,
  onAmountChange,
  onEdit,
  onReview,
}: {
  recipient: string;
  amount: string;
  onAmountChange: (a: string) => void;
  onEdit: () => void;
  onReview: () => void;
}) {
  return (
    <div style={PANEL_BODY}>
      <div style={{ ...ADDR_CHIP_GREEN, padding: "8px 10px" }}>
        <span style={{ flex: 1 }}>
          → {recipient} · {RESOLVED_ADDR}
        </span>
        <button
          type="button"
          onClick={onEdit}
          style={{
            color: "var(--text-mute)",
            cursor: "pointer",
            background: "transparent",
            border: "none",
          }}
        >
          edit
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
          AMOUNT
        </div>
        <div
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--border-soft)",
            borderRadius: 12,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <input
            value={amount}
            onChange={(e) => {
              onAmountChange(e.target.value);
            }}
            className="mono"
            style={{
              fontSize: 22,
              fontWeight: 500,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              minWidth: 0,
              flex: 1,
            }}
          />
          <div
            style={{
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
            }}
          >
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
          <span>Agent balance: 468.20 USDC</span>
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

      <Banner tone="info">
        This send uses <b>${amount}</b> of agent's daily cap.{" "}
        <b style={{ color: "var(--green)" }}>$63 will remain</b> after.
      </Banner>

      <button
        type="button"
        style={{ ...BTN_PRIMARY, width: "100%", padding: 12 }}
        onClick={onReview}
      >
        Review send
      </button>
    </div>
  );
}

function ReviewStep({
  amount,
  onEdit,
  onConfirm,
}: {
  amount: string;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={PANEL_BODY}>
      <div
        style={{
          background: "var(--bg-elev)",
          border: "1px solid var(--border-soft)",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "var(--text-mute)",
            letterSpacing: ".06em",
          }}
        >
          SENDING
        </div>
        <div
          className="mono"
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TokenChip sym="USDC" size={26} /> {amount} USDC
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
          ≈ ${amount} · mainnet price reference (testnet)
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
          TO
        </div>
        <div
          style={{
            ...ADDR_CHIP_GREEN,
            padding: "9px 10px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <span style={{ flex: 1, fontSize: 11 }}>{FULL_RESOLVED}</span>
          <a>⎘</a>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
          vitalik.eth · resolved 8s ago
        </div>
      </div>

      <DetailRows
        rows={[
          { label: "Estimated gas", value: "0.00012 ETH ≈ $0.43" },
          { label: "Network", value: "Base Sepolia" },
          {
            label: "Cap impact",
            value: <span style={{ color: "var(--green)" }}>$63 remaining after</span>,
          },
        ]}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onEdit}>
          Edit
        </button>
        <button type="button" style={{ ...BTN_PRIMARY, flex: 2 }} onClick={onConfirm}>
          Confirm send
        </button>
      </div>
    </div>
  );
}

function PendingStep({ amount }: { amount: string }) {
  return (
    <div
      style={{
        ...PANEL_BODY,
        alignItems: "center",
        gap: 14,
        padding: "30px 20px",
      }}
    >
      <Spinner size="lg" agent />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Waiting for confirmation</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          Broadcasting to Base Sepolia…
        </div>
      </div>
      <TxRow hash={TX_HASH} />
      <div style={{ fontSize: 10, color: "var(--text-mute)" }}>
        Expected confirmation in ~12s · {amount} USDC
      </div>
    </div>
  );
}

function SuccessStep({
  amount,
  onAgain,
  onDone,
}: {
  amount: string;
  onAgain: () => void;
  onDone: () => void;
}) {
  return (
    <div
      style={{
        ...PANEL_BODY,
        alignItems: "center",
        gap: 14,
        padding: "30px 20px",
      }}
    >
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
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Sent {amount} USDC</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          to vitalik.eth · confirmed in 8s
        </div>
      </div>
      <TxRow hash={TX_HASH} />
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <button type="button" style={{ ...BTN_GHOST, flex: 1 }} onClick={onAgain}>
          Send another
        </button>
        <button type="button" style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
