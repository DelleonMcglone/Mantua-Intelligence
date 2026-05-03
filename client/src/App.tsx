import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { AppShell } from "./components/shell/AppShell.tsx";
import { Card } from "./components/shell/Card.tsx";
import { HomeMenu, type HomePromptId } from "./components/shell/HomeMenu.tsx";
import { InputBar } from "./components/shell/InputBar.tsx";
import { AgentPanel } from "./features/agent/AgentPanel.tsx";
import { AnalyzePanel } from "./features/analyze/AnalyzePanel.tsx";
import {
  CommandBar,
  type CommandBarPage,
  type CommandIntent,
} from "./features/command-bar/CommandBar.tsx";
import { PortfolioCard } from "./features/portfolio/PortfolioCard.tsx";
import { AssetsCard } from "./features/portfolio/AssetsCard.tsx";
import { SwapPanel } from "./features/swap/SwapPanel.tsx";
import { AddLiquidityForm } from "./features/liquidity/AddLiquidityForm.tsx";
import type { PoolKeyContext } from "./features/liquidity/AddLiquidityForm.tsx";
import { LiquidityListPage } from "./features/liquidity/LiquidityListPage.tsx";
import { PoolCreateForm } from "./features/liquidity/PoolCreateForm.tsx";
import { PoolDetailPage } from "./features/liquidity/PoolDetailPage.tsx";
import { PositionsList } from "./features/liquidity/PositionsList.tsx";

type Route =
  | { kind: "home" }
  | { kind: "swap" }
  | { kind: "pools" }
  | { kind: "pool"; id: string }
  | { kind: "pool-create" }
  | { kind: "add-liquidity"; ctx: PoolKeyContext }
  | { kind: "positions" }
  | { kind: "analyze" }
  | { kind: "agent" };

export default function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [route, setRoute] = useState<Route>({ kind: "home" });

  if (!ready) {
    return (
      <main className="min-h-screen bg-bg text-text flex items-center justify-center">
        <p className="text-sm text-text-dim">Loading…</p>
      </main>
    );
  }

  const walletAddress = user?.wallet?.address;

  const handleConnect = () => {
    // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator, @typescript-eslint/no-confusing-void-expression
    void login();
  };
  const handleDisconnect = () => {
    void logout();
  };

  return (
    <AppShell
      walletAddress={walletAddress}
      onConnect={authenticated ? undefined : handleConnect}
      onDisconnect={authenticated ? handleDisconnect : undefined}
      left={<LeftColumn />}
      right={<RightColumn route={route} setRoute={setRoute} />}
    />
  );
}

function LeftColumn() {
  return (
    <>
      <PortfolioCard />
      <AssetsCard />
    </>
  );
}

const ROUTES_WITH_COMMAND_BAR = new Set<Route["kind"]>([
  "swap",
  "pools",
  "pool",
  "pool-create",
  "add-liquidity",
  "positions",
  "agent",
]);

function pageFromRoute(route: Route): CommandBarPage {
  switch (route.kind) {
    case "swap":
      return "swap";
    case "pools":
    case "pool":
    case "pool-create":
    case "add-liquidity":
    case "positions":
      return "liquidity";
    case "agent":
      return "agent";
    case "analyze":
      return "analytics";
    case "home":
      return "other";
  }
}

function routeFromIntent(intent: CommandIntent, setRoute: (r: Route) => void) {
  switch (intent.action) {
    case "swap":
      setRoute({ kind: "swap" });
      return;
    case "add_liquidity":
      setRoute({ kind: "pools" });
      return;
    case "remove_liquidity":
      setRoute({ kind: "positions" });
      return;
    case "create_pool":
      setRoute({ kind: "pool-create" });
      return;
    case "send_tokens":
    case "portfolio_summary":
      // Send + Portfolio live inside the agent panel (Send) and the
      // home/left column (Portfolio). Route to the most reasonable
      // surface for each — proper deep-link wiring lands in PN-010.
      setRoute({ kind: intent.action === "portfolio_summary" ? "home" : "agent" });
      return;
    case "query_analytics":
      setRoute({ kind: "analyze" });
      return;
    case "clarification_needed":
    case "reject":
      // Handled inside CommandBar — preview card stays open with the
      // clarification message or rejection reason.
      return;
  }
}

function RightColumn({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  const showCommandBar = ROUTES_WITH_COMMAND_BAR.has(route.kind);
  const poolId = route.kind === "pool" ? route.id : undefined;
  return (
    <Card className="flex-1 flex flex-col p-0 overflow-hidden self-stretch" style={{ padding: 0 }}>
      {showCommandBar && (
        <CommandBar
          page={pageFromRoute(route)}
          {...(poolId ? { poolId } : {})}
          onIntent={(intent) => {
            routeFromIntent(intent, setRoute);
          }}
        />
      )}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <RouteContent route={route} setRoute={setRoute} />
      </div>
      <InputBar
        onSubmit={(text) => {
          handleChatCommand(text, setRoute);
        }}
      />
    </Card>
  );
}

function RouteContent({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  switch (route.kind) {
    case "home":
      return (
        <HomeMenu
          onPromptSelect={(id) => {
            setRoute(promptToRoute(id));
          }}
          onNewChat={() => {
            setRoute({ kind: "home" });
          }}
          onHistory={() => undefined}
        />
      );
    case "swap":
      return <SwapPanel />;
    case "pools":
      return (
        <LiquidityListPage
          onSelectPool={(id) => {
            setRoute({ kind: "pool", id });
          }}
          onCreate={() => {
            setRoute({ kind: "pool-create" });
          }}
        />
      );
    case "pool":
      return (
        <PoolDetailPage
          poolId={route.id}
          onBack={() => {
            setRoute({ kind: "pools" });
          }}
          onAddLiquidity={(ctx) => {
            setRoute({ kind: "add-liquidity", ctx });
          }}
        />
      );
    case "pool-create":
      return (
        <PoolCreateForm
          onBack={() => {
            setRoute({ kind: "pools" });
          }}
          onAddLiquidity={(ctx) => {
            setRoute({ kind: "add-liquidity", ctx });
          }}
        />
      );
    case "add-liquidity":
      return (
        <AddLiquidityForm
          ctx={route.ctx}
          onBack={() => {
            setRoute({ kind: "positions" });
          }}
        />
      );
    case "positions":
      return <PositionsList />;
    case "analyze":
      return (
        <AnalyzePanel
          onClose={() => {
            setRoute({ kind: "home" });
          }}
        />
      );
    case "agent":
      return (
        <AgentPanel
          onClose={() => {
            setRoute({ kind: "home" });
          }}
        />
      );
  }
}

function promptToRoute(id: HomePromptId): Route {
  switch (id) {
    case "pool":
      return { kind: "pools" };
    case "swap":
      return { kind: "swap" };
    case "analyze":
      return { kind: "analyze" };
    case "agent":
      return { kind: "agent" };
  }
}

function handleChatCommand(text: string, setRoute: (r: Route) => void) {
  const lower = text.toLowerCase();
  if (/swap|exchange|trade/.test(lower)) {
    setRoute({ kind: "swap" });
    return;
  }
  if (/position/.test(lower)) {
    setRoute({ kind: "positions" });
    return;
  }
  if (/pool|liquidity|lp/.test(lower)) {
    setRoute({ kind: "pools" });
    return;
  }
}
