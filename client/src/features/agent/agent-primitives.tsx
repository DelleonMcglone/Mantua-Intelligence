import type { CSSProperties, ReactNode } from "react";

/**
 * Shared atoms for the agent flows — verbatim ports of the small
 * building blocks defined in `Mantua Agent Flows.html` (`.btn`,
 * `.banner`, `.tok`, `.tx-row`, `.bigval`, `.detail-rows`, `.x-close`).
 * Centralized so every flow renders the exact same pixels.
 */

// ── Buttons ────────────────────────────────────────────────────────

export const BTN_BASE: CSSProperties = {
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  transition: "all .15s",
  padding: "10px 14px",
  border: "1px solid transparent",
  fontFamily: "inherit",
  color: "inherit",
};

export const BTN_PRIMARY: CSSProperties = {
  ...BTN_BASE,
  background: "var(--accent)",
  color: "#fff",
  border: "none",
};

export const BTN_GHOST: CSSProperties = {
  ...BTN_BASE,
  background: "transparent",
  color: "var(--text-dim)",
  border: "1px solid var(--border)",
};

export const BTN_DANGER: CSSProperties = {
  ...BTN_BASE,
  background: "rgba(255,107,107,0.10)",
  color: "var(--red)",
  border: "1px solid rgba(255,107,107,0.35)",
};

export const X_CLOSE: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-dim)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
};

// ── Panel chrome ───────────────────────────────────────────────────

export const PANEL_HEAD: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--border-soft)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "var(--bg-elev)",
};

export const PANEL_TITLE: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

export const PANEL_BODY: CSSProperties = {
  padding: 18,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  overflow: "auto",
};

// ── Token chip (.tok) ─────────────────────────────────────────────

const TOK_COLORS: Record<string, { bg: string; fg: string }> = {
  ETH: { bg: "#627eea", fg: "#fff" },
  WETH: { bg: "#627eea", fg: "#fff" },
  BTC: { bg: "#0052ff", fg: "#fff" },
  cbBTC: { bg: "#0052ff", fg: "#fff" },
  USDC: { bg: "#2775ca", fg: "#fff" },
  USDT: { bg: "#26a17b", fg: "#fff" },
  EURC: { bg: "#003399", fg: "#ffcc00" },
};

const TOK_LETTER: Record<string, string> = {
  ETH: "E",
  WETH: "E",
  BTC: "₿",
  cbBTC: "₿",
  USDC: "U",
  USDT: "T",
  EURC: "€",
};

export function TokenChip({ sym, size = 22 }: { sym: string; size?: number }) {
  const c = TOK_COLORS[sym] ?? { bg: "#3a3a45", fg: "#fff" };
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(8, Math.round(size * 0.4)),
        fontWeight: 700,
        background: c.bg,
        color: c.fg,
      }}
    >
      {TOK_LETTER[sym] ?? sym.slice(0, 1)}
    </span>
  );
}

// ── Banner (warn/error/success/info) ──────────────────────────────

const BANNER_TONES: Record<
  "warn" | "error" | "success" | "info",
  { bg: string; border: string; ic: string }
> = {
  warn: {
    bg: "rgba(245,165,36,0.10)",
    border: "1px solid rgba(245,165,36,0.35)",
    ic: "var(--amber)",
  },
  error: {
    bg: "rgba(255,107,107,0.10)",
    border: "1px solid rgba(255,107,107,0.35)",
    ic: "var(--red)",
  },
  success: {
    bg: "rgba(61,220,151,0.10)",
    border: "1px solid rgba(61,220,151,0.35)",
    ic: "var(--green)",
  },
  info: {
    bg: "var(--bg-elev)",
    border: "1px solid var(--border-soft)",
    ic: "var(--text-dim)",
  },
};

export function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: "warn" | "error" | "success" | "info";
  icon?: ReactNode;
  title?: string;
  children?: ReactNode;
}) {
  const t = BANNER_TONES[tone];
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "11px 12px",
        borderRadius: 10,
        alignItems: "flex-start",
        fontSize: 12,
        lineHeight: 1.55,
        background: t.bg,
        border: t.border,
        color: "var(--text)",
      }}
    >
      {icon && (
        <span style={{ flexShrink: 0, marginTop: 1, color: t.ic, fontSize: 13 }}>{icon}</span>
      )}
      <div>
        {title && (
          <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{title}</div>
        )}
        {children && <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{children}</div>}
      </div>
    </div>
  );
}

// ── Detail rows (label/value pairs) ───────────────────────────────

export function DetailRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <div style={{ fontSize: 13 }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "7px 0",
            borderBottom: i < rows.length - 1 ? "1px dashed var(--border-soft)" : "none",
          }}
        >
          <span style={{ color: "var(--text-dim)" }}>{row.label}</span>
          <span className="mono">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tx-row (hash chip with explorer link) ─────────────────────────

export function TxRow({
  hash,
  explorerUrl,
  showCopy = true,
}: {
  hash: string;
  explorerUrl?: string;
  showCopy?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "var(--bg-elev)",
        borderRadius: 10,
        fontSize: 12,
        border: "1px solid var(--border-soft)",
        width: "100%",
      }}
    >
      <span className="mono" style={{ color: "var(--text-dim)", flex: 1 }}>
        {hash}
      </span>
      {showCopy && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(hash);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: 11,
            padding: 0,
          }}
          aria-label="Copy hash"
        >
          ⎘
        </button>
      )}
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--text-dim)",
            fontSize: 11,
            textDecoration: "none",
          }}
        >
          ↗ BaseScan
        </a>
      )}
    </div>
  );
}

// ── Bigval (centered headline + sub) ──────────────────────────────

export function BigVal({
  label,
  value,
  sub,
  padding = "20px 12px",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  padding?: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding,
        background: "var(--bg-elev)",
        borderRadius: 12,
        border: "1px solid var(--border-soft)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-mute)",
          letterSpacing: ".08em",
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: "-.02em",
          marginTop: 6,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Spinner (.spinner / .spinner.lg / .spinner.agent) ─────────────

export function Spinner({ size = "sm", agent = false }: { size?: "sm" | "lg"; agent?: boolean }) {
  const px = size === "lg" ? 38 : 18;
  const bw = size === "lg" ? 3 : 2;
  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: 99,
        border: `${String(bw)}px solid var(--border)`,
        borderTopColor: agent ? "var(--agent)" : "var(--accent)",
        animation: "spin .8s linear infinite",
      }}
    />
  );
}

// ── Skeleton (shimmer bar) ────────────────────────────────────────

export function Skel({
  height = 10,
  width = "100%",
}: {
  height?: number;
  width?: string | number;
}) {
  return (
    <div
      style={{
        width,
        height,
        background:
          "linear-gradient(90deg, var(--bg-elev) 0%, var(--chip) 50%, var(--bg-elev) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.6s infinite linear",
        borderRadius: 6,
      }}
    />
  );
}
