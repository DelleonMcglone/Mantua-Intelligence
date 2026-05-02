import type { ReactNode } from "react";

interface AgentStripProps {
  /** Top line — "Agent wallet" / "From agent wallet" / "Sending to" / etc. */
  label: string;
  /** Bottom line — truncated address or context string. Pass a ReactNode
   *  if you need a basescan link inside it. */
  addr: ReactNode;
  /** Right-side cap pill. Tone shifts the colors:
   *  - default → chip background, dim text ("$32 / $100 today")
   *  - green   → "$68 left" or "$132 / $100 today" (cap reset bonus)
   *  - red     → "$0 left" / cap-exceeded warning
   *  Omit entirely to render no pill. */
  cap?: { text: string; tone?: "default" | "green" | "red" };
  /** Override the badge initial. Defaults to "A". */
  badge?: string;
}

const STRIP_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  borderBottom: "1px solid var(--border-soft)",
  background: "linear-gradient(90deg, var(--agent-dim), transparent 60%)",
  borderLeft: "2px solid var(--agent)",
};

const BADGE_STYLE: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  background: "var(--agent-dim)",
  border: "1px solid var(--agent-bd)",
  color: "var(--agent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 600,
};

const CAP_BASE: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 10,
  fontFamily: "JetBrains Mono, monospace",
  padding: "3px 7px",
  borderRadius: 6,
};

const CAP_TONES: Record<NonNullable<AgentStripProps["cap"]>["tone"] & string, React.CSSProperties> =
  {
    default: {
      background: "var(--chip)",
      border: "1px solid var(--border-soft)",
      color: "var(--text-dim)",
    },
    green: {
      background: "rgba(61,220,151,.10)",
      border: "1px solid rgba(61,220,151,.35)",
      color: "var(--green)",
    },
    red: {
      background: "rgba(255,107,107,.10)",
      border: "1px solid rgba(255,107,107,.35)",
      color: "var(--red)",
    },
  };

/**
 * AgentStrip — pixel port of `.agent-strip` from
 * `mantua-ai/project/Mantua Agent Flows.html`. Sits at the top of every
 * agent-scoped panel so the agent's identity (badge + wallet address +
 * remaining daily cap) is visible on every step. Teal gradient fades
 * left → transparent; left edge always carries the 2px teal stripe.
 */
export function AgentStrip({ label, addr, cap, badge = "A" }: AgentStripProps) {
  return (
    <div style={STRIP_STYLE}>
      <div style={BADGE_STYLE}>{badge}</div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{label}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text)" }}>
          {addr}
        </div>
      </div>
      {cap && <div style={{ ...CAP_BASE, ...CAP_TONES[cap.tone ?? "default"] }}>{cap.text}</div>}
    </div>
  );
}
