import type { ReactNode } from "react";
import { Header } from "./Header.tsx";

interface AppShellProps {
  walletAddress?: string | undefined;
  onConnect?: () => void;
  onDisconnect?: () => void;
  left: ReactNode;
  right: ReactNode;
}

/**
 * PD-004 — app shell layout. Matches the prototype 2-column grid (340/460
 * minimums, 1/1.3 ratio) with density-scaled padding and gap. Below 1024px
 * the grid collapses to a single column; the right column stacks below
 * (deviation from prototype, documented in PD-007).
 */
export function AppShell({
  walletAddress,
  onConnect,
  onDisconnect,
  left,
  right,
}: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <Header
        walletAddress={walletAddress}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />
      <main
        className="grid flex-1 min-h-0 items-stretch"
        style={{
          gridTemplateColumns: "1fr",
          padding: "calc(20px * var(--density)) calc(32px * var(--density))",
          gap: "calc(20px * var(--density))",
        }}
      >
        <div
          className="grid min-h-0"
          style={{
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: "calc(20px * var(--density))",
          }}
        >
          {/* Two-column at ≥1024px; stacks below. Done in style attr because
              Tailwind 4 minmax + var() in arbitrary values is fiddly. */}
          <div
            className="grid min-h-0"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
              gap: "calc(20px * var(--density))",
            }}
          >
            <div className="flex flex-col min-h-0" style={{ gap: "calc(20px * var(--density))" }}>
              {left}
            </div>
            <div className="flex flex-col min-h-0">{right}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
