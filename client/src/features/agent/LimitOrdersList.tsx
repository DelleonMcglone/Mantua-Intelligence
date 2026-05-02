/**
 * F10 — Limit orders list. Verbatim port of `LimitOrdersList` from
 * `mantua-ai/project/src/agent_flows.jsx`. Renders a vertical list of
 * pending AsyncLimitOrder positions with an inline Cancel button per
 * row. Empty-state copy + glyph match the prototype exactly.
 *
 * `SAMPLE_LIMITS` is exported for callers to use as the initial value
 * during development (per scope (c) = keep fixtures). Production
 * callers will pass server data instead.
 */

export interface LimitOrder {
  id: string;
  label: string;
  target: string;
  current: string;
  expires: string;
}

/** Verbatim from `agent_flows.jsx:246`. */
export const SAMPLE_LIMITS: LimitOrder[] = [
  {
    id: "LO-218",
    label: "Sell 1.0 ETH for USDC",
    target: "2,500.00",
    current: "2,420.18",
    expires: "6d 14h",
  },
  {
    id: "LO-217",
    label: "Buy 0.5 ETH with USDC",
    target: "2,300.00",
    current: "2,420.18",
    expires: "22h",
  },
  {
    id: "LO-216",
    label: "Sell 0.05 cbBTC for USDC",
    target: "70,000.00",
    current: "67,224.32",
    expires: "4d",
  },
];

export interface LimitOrdersListProps {
  orders?: LimitOrder[];
  onCancel?: (id: string) => void;
}

const PILL_ALO: React.CSSProperties = {
  padding: "1px 6px",
  fontSize: 9,
  borderRadius: 99,
  background: "rgba(139,108,240,0.14)",
  color: "#a892ff",
  border: "1px solid rgba(139,108,240,0.35)",
};

export function LimitOrdersList({ orders = SAMPLE_LIMITS, onCancel }: LimitOrdersListProps) {
  if (orders.length === 0) {
    return (
      <div
        style={{
          padding: "40px 20px",
          textAlign: "center",
          color: "var(--text-dim)",
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.5 }}>⏱</div>
        <div
          style={{
            fontSize: 13,
            marginTop: 8,
            fontWeight: 500,
            color: "var(--text)",
          }}
        >
          No active limit orders
        </div>
        <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 4 }}>
          Use the ⌘K command bar or Swap → Limit tab to place one.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {orders.map((o) => (
        <div
          key={o.id}
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              {o.label}
              <span style={PILL_ALO}>AsyncLimitOrder</span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-mute)",
                marginTop: 3,
              }}
            >
              Target {o.target} · Current {o.current} · expires in {o.expires}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onCancel?.(o.id);
            }}
            style={{
              padding: "5px 10px",
              fontSize: 11,
              borderRadius: 7,
              background: "transparent",
              color: "var(--text-dim)",
              border: "1px solid var(--border-soft)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      ))}
    </div>
  );
}
