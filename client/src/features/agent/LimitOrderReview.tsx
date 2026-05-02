import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * F10 — AsyncLimitOrder review modal. Verbatim port of
 * `LimitOrderReview` from `mantua-ai/project/src/agent_flows.jsx`.
 *
 * Single-screen review: SELL → FOR card, target / current / expiry /
 * hook detail rows, optional ⚠ banner when |target − current| > 2%,
 * "Place limit order" CTA. Standalone modal — no entry point in
 * pass 2 (per scope (b) = built, un-wired). Caller passes the
 * `onPlace` callback which can call `useALOPlaceOrder.placeOrder(…)`
 * to submit the on-chain transaction.
 */

export interface LimitOrderReviewProps {
  open: boolean;
  /** Token being sold (input). */
  from: { sym: string; amount: string };
  /** Token being received (output). */
  to: { sym: string };
  /** Target price as a string (e.g. "2,500"). */
  target: string;
  /** Current spot price (numeric — used to compute the % delta). */
  currentPrice: number;
  /** Expiry label (e.g. "7 days"). */
  expiry: string;
  /** Disable the place-order CTA (e.g. while placing). */
  placing?: boolean;
  /** Inline error message rendered above the CTA. */
  errorMessage?: string;
  onClose: () => void;
  onPlace: () => void;
}

const BACKDROP: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#000a",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  animation: "fadeIn .2s",
};

const MODAL: React.CSSProperties = {
  width: "92%",
  maxWidth: 460,
  background: "var(--panel-solid)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  boxShadow: "0 20px 60px #000c",
};

export function LimitOrderReview({
  open,
  from,
  to,
  target,
  currentPrice,
  expiry,
  placing,
  errorMessage,
  onClose,
  onPlace,
}: LimitOrderReviewProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !placing) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, placing]);

  if (!open) return null;

  const targetNum = parseFloat(target.replace(/,/g, ""));
  const pct = ((targetNum - currentPrice) / currentPrice) * 100;
  const above = pct > 0;
  const showWarn = Math.abs(pct) > 2;

  return createPortal(
    <div
      style={BACKDROP}
      onClick={() => {
        if (!placing) onClose();
      }}
    >
      <div
        style={MODAL}
        role="dialog"
        aria-modal="true"
        aria-label="Review limit order"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>Review limit order</div>
          <button
            type="button"
            onClick={onClose}
            disabled={placing}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-mute)",
              cursor: placing ? "not-allowed" : "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div
            style={{
              padding: 14,
              background: "var(--bg-elev)",
              border: "1px solid var(--border-soft)",
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-mute)" }}>SELL</div>
            <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>
              {from.amount} {from.sym}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 10 }}>FOR</div>
            <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>
              {target} {to.sym}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 14,
              fontSize: 12,
            }}
          >
            <Row label="Target price" value={`${target} ${to.sym}/${from.sym}`} />
            <Row
              label="Current price"
              value={`${currentPrice.toLocaleString()} ${to.sym}/${from.sym}`}
            />
            <Row label="Expires" value={`In ${expiry}`} />
            <Row label="Hook" value={<span style={{ color: "#a892ff" }}>AsyncLimitOrder</span>} />
          </div>

          {showWarn && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "rgba(245,165,36,0.08)",
                border: "1px solid rgba(245,165,36,0.30)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--text-dim)",
                lineHeight: 1.5,
              }}
            >
              <b style={{ color: "#f5a524" }}>
                ⚠ Target is {Math.abs(pct).toFixed(2)}% {above ? "above" : "below"} market.
              </b>{" "}
              Order may take longer to fill, or expire unfilled. Async execution means the price has
              to actually reach your target.
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "rgba(255,107,107,0.10)",
                border: "1px solid rgba(255,107,107,0.35)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--red)",
                lineHeight: 1.5,
              }}
            >
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={onPlace}
            disabled={placing}
            style={{
              width: "100%",
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              cursor: placing ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 500,
              opacity: placing ? 0.7 : 1,
            }}
          >
            {placing ? "Placing…" : "Place limit order"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--text-mute)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
