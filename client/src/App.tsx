import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { AppShell } from "./components/shell/AppShell.tsx";
import { Card } from "./components/shell/Card.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { SwapPanel } from "./features/swap/SwapPanel.tsx";
import { LiquidityListPage } from "./features/liquidity/LiquidityListPage.tsx";
import { PoolCreateForm } from "./features/liquidity/PoolCreateForm.tsx";
import { PoolDetailPage } from "./features/liquidity/PoolDetailPage.tsx";

/**
 * Phase 4a adds the Liquidity surface (list + detail). Routing is local
 * state for now — a real router (e.g. react-router) lands when there
 * are 4+ pages worth of state to manage.
 */
type Route =
  | { kind: "swap" }
  | { kind: "pools" }
  | { kind: "pool"; id: string }
  | { kind: "pool-create" };

export default function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [route, setRoute] = useState<Route>({ kind: "swap" });

  if (!ready) return <LoginScreen onLogin={() => undefined} loading />;
  if (!authenticated) return <LoginScreen onLogin={login} />;

  const walletAddress = user?.wallet?.address;

  return (
    <AppShell
      walletAddress={walletAddress}
      onDisconnect={() => {
        void logout();
      }}
      left={<LeftColumn />}
      right={<RightColumn route={route} setRoute={setRoute} />}
    />
  );
}

function LeftColumn() {
  return (
    <>
      <Card>
        <p className="text-xs text-text-mute uppercase tracking-wider">Portfolio</p>
        <p className="text-3xl font-semibold mt-1 font-mono">$72,697.83</p>
        <p className="text-sm text-green mt-1">↗ 3.51% past week</p>
        <p className="text-xs text-text-dim mt-4">
          Real chart + balances arrive in Phase 8 (Portfolio).
        </p>
      </Card>
      <Card>
        <p className="text-xs text-text-mute uppercase tracking-wider">Assets</p>
        <p className="text-sm text-text-dim mt-2">ETH · cbBTC · USDC · EURC · LINK</p>
        <p className="text-xs text-text-mute mt-4">Wired to live balances in Phase 8.</p>
      </Card>
    </>
  );
}

function RightColumn({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      <Tabs route={route} setRoute={setRoute} />
      {route.kind === "swap" && <SwapPanel />}
      {route.kind === "pools" && (
        <LiquidityListPage
          onSelectPool={(id) => {
            setRoute({ kind: "pool", id });
          }}
          onCreate={() => {
            setRoute({ kind: "pool-create" });
          }}
        />
      )}
      {route.kind === "pool" && (
        <PoolDetailPage
          poolId={route.id}
          onBack={() => {
            setRoute({ kind: "pools" });
          }}
        />
      )}
      {route.kind === "pool-create" && (
        <PoolCreateForm
          onBack={() => {
            setRoute({ kind: "pools" });
          }}
        />
      )}
    </div>
  );
}

function Tabs({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  const tabs = [
    { id: "swap" as const, label: "Swap" },
    { id: "pools" as const, label: "Liquidity" },
  ];
  const active =
    route.kind === "pool" || route.kind === "pool-create" ? "pools" : route.kind;
  return (
    <div className="inline-flex bg-bg-elev rounded-full p-0.5 border border-border-soft self-start">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            setRoute({ kind: t.id });
          }}
          className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
            active === t.id ? "bg-chip text-text" : "text-text-dim hover:text-text"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
