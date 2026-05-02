import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "./agent-primitives.tsx";

/**
 * F9 — RWAGate verification modal. Verbatim port of `RWAGateModal`
 * from `mantua-ai/project/src/agent_flows.jsx`. Three phases:
 *   intro     — explanation + CTA (Get verified / View pool data anyway)
 *   verifying — spinner + "Reading ComplianceRegistry"
 *   done      — green check + Continue
 *
 * Standalone modal — no entry point wired in pass 2 (per scope (a) =
 * standalone, un-wired). The caller passes the pool pair and an
 * `onVerified` callback that fires once the user clicks Continue.
 *
 * The modal is **mount-driven** — render `<RWAGateModal … />` only
 * when you want it open, conditional on caller-side state. Each mount
 * gets a fresh phase, so re-opening always starts at `intro`.
 */

export interface RWAGateModalProps {
  pool: { a: string; b: string };
  onClose: () => void;
  onVerified?: () => void;
}

type Phase = "intro" | "verifying" | "done";

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
  maxWidth: 440,
  background: "var(--panel-solid)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  boxShadow: "0 20px 60px #000c",
};

export function RWAGateModal({ pool, onClose, onVerified }: RWAGateModalProps) {
  const [phase, setPhase] = useState<Phase>("intro");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "verifying") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, phase]);

  return createPortal(
    <div
      style={BACKDROP}
      onClick={() => {
        if (phase !== "verifying") onClose();
      }}
    >
      <div
        style={MODAL}
        role="dialog"
        aria-modal="true"
        aria-label="Verification required"
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
          <div style={{ fontSize: 14, fontWeight: 600 }}>🔒 Verification required</div>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "verifying"}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-mute)",
              cursor: phase === "verifying" ? "not-allowed" : "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          {phase === "intro" && (
            <>
              <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
                The{" "}
                <b style={{ color: "var(--text)" }}>
                  {pool.a}/{pool.b}
                </b>{" "}
                pool is restricted to KYC-verified wallets. Your wallet is not currently on the
                allowlist for this pool.
              </div>
              <div
                style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 10, lineHeight: 1.5 }}
              >
                Verification is handled by an external KYC partner. Allowlist is managed via the
                on-chain ComplianceRegistry contract.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-soft)",
                    background: "transparent",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  View pool data anyway
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("verifying");
                    setTimeout(() => {
                      setPhase("done");
                    }, 1800);
                  }}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Get verified
                </button>
              </div>
            </>
          )}

          {phase === "verifying" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ display: "inline-block" }}>
                <Spinner size="sm" />
              </div>
              <div style={{ fontSize: 13, marginTop: 14, fontWeight: 500 }}>
                Verifying with KYC partner…
              </div>
              <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 4 }}>
                Reading ComplianceRegistry
              </div>
            </div>
          )}

          {phase === "done" && (
            <>
              <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(61,220,151,0.14)",
                    border: "1px solid rgba(61,220,151,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#3ddc97",
                    fontSize: 22,
                    margin: "0 auto",
                  }}
                >
                  ✓
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12 }}>
                  Verified for this pool
                </div>
                <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 4 }}>
                  You can now provide liquidity and trade in {pool.a}/{pool.b}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onVerified?.();
                  onClose();
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
