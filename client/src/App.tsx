import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { AppShell } from "./components/shell/AppShell.tsx";
import { Card } from "./components/shell/Card.tsx";
import { HomeMenu, type HomePromptId } from "./components/shell/HomeMenu.tsx";
import { InputBar } from "./components/shell/InputBar.tsx";
import { AgentPanel } from "./features/agent/AgentPanel.tsx";
import { AnalyzePanel } from "./features/analyze/AnalyzePanel.tsx";
import { PortfolioCard } from "./features/portfolio/PortfolioCard.tsx";
import { AssetsCard } from "./features/portfolio/AssetsCard.tsx";
import { SwapPanel } from "./features/swap/SwapPanel.tsx";
import { AddLiquidityForm } from "./features/liquidity/AddLiquidityForm.tsx";
import type { PoolKeyContext } from "./features/liquidity/AddLiquidityForm.tsx";
import { LiquidityListPage } from "./features/liquidity/LiquidityListPage.tsx";
import { PoolDetailPage } from "./features/liquidity/PoolDetailPage.tsx";
import { PositionsList } from "./features/liquidity/PositionsList.tsx";

type AnalyzeTopic =
  | "eth-price"
  | "eurc-peg"
  | "usdc-usdt-pool"
  | "top-rwa-tokens"
  | "cbbtc-24h-volume"
  | "mantua-hooks";

type Route =
  | { kind: "home" }
  | { kind: "swap" }
  | { kind: "pools" }
  | { kind: "pool"; id: string }
  | { kind: "add-liquidity"; ctx?: PoolKeyContext }
  | { kind: "positions" }
  | { kind: "analyze"; topic?: AnalyzeTopic; question?: string }
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

function RightColumn({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  return (
    <Card className="flex-1 flex flex-col p-0 overflow-hidden self-stretch" style={{ padding: 0 }}>
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
      return (
        <SwapPanel
          onClose={() => {
            setRoute({ kind: "home" });
          }}
        />
      );
    case "pools":
      return (
        <LiquidityListPage
          onSelectPool={(id) => {
            setRoute({ kind: "pool", id });
          }}
          onCreate={() => {
            setRoute({ kind: "add-liquidity" });
          }}
          onClose={() => {
            setRoute({ kind: "home" });
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
            setRoute({ kind: "add-liquidity", ctx: { ...ctx, locked: true } });
          }}
          onClose={() => {
            setRoute({ kind: "home" });
          }}
        />
      );
    case "add-liquidity":
      return (
        <AddLiquidityForm
          {...(route.ctx ? { ctx: route.ctx } : {})}
          onBack={() => {
            setRoute({ kind: "pools" });
          }}
          onClose={() => {
            setRoute({ kind: "home" });
          }}
        />
      );
    case "positions":
      return (
        <PositionsList
          onClose={() => {
            setRoute({ kind: "home" });
          }}
        />
      );
    case "analyze":
      // Key on topic+question so submitting a fresh query while
      // already on the analyze panel remounts with the new initial
      // state — otherwise the seeded useState wouldn't update.
      return (
        <AnalyzePanel
          key={`${route.topic ?? "none"}|${route.question ?? ""}`}
          {...(route.topic ? { initialTopic: route.topic } : {})}
          {...(route.question ? { initialQuestion: route.question } : {})}
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

/**
 * Heuristic intent matcher for natural-language chat input. Maps the
 * user's free-form question to either a navigation route (swap /
 * positions / pools) or — for analyze-shaped questions — an
 * `AnalyzePanel` deep-link with the right topic pre-selected. Returns
 * null when nothing matches so the caller can fall back to a generic
 * "I didn't catch that" path.
 *
 * Order matters: more specific patterns first. The analyze branch
 * handles the suggestion strings verbatim plus a few common
 * paraphrases; pool / swap / positions are last so an explicit
 * analyze question doesn't accidentally route to a panel switch.
 */
function detectIntent(text: string): Route | null {
  const t = text.toLowerCase();

  // Analyze topics — most specific keywords first.
  if (/\bhook(s)?\b/.test(t) && /(learn|explain|what|tell|describe|how)/.test(t)) {
    return { kind: "analyze", topic: "mantua-hooks", question: text };
  }
  if (/\bcb.?btc\b/.test(t) && /(volume|trend|24h|24 ?hour)/.test(t)) {
    return { kind: "analyze", topic: "cbbtc-24h-volume", question: text };
  }
  if (
    /(rwa|real.?world.?asset)/.test(t) ||
    (/(top|best|leading)/.test(t) && /(token|asset)/.test(t) && /(rwa|real)/.test(t))
  ) {
    return { kind: "analyze", topic: "top-rwa-tokens", question: text };
  }
  if (/\beurc\b/.test(t) && /(peg|above|below|stable|deviation)/.test(t)) {
    return { kind: "analyze", topic: "eurc-peg", question: text };
  }
  if (/\busdc\b/.test(t) && /\busdt\b/.test(t)) {
    return { kind: "analyze", topic: "usdc-usdt-pool", question: text };
  }
  if (
    /\b(eth|ethereum)\b/.test(t) &&
    /(price|cost|worth|trading|value|how much)/.test(t)
  ) {
    return { kind: "analyze", topic: "eth-price", question: text };
  }

  // Generic analyze opener — "analyze X", "research X", "what is X"
  // when no topic matched. Lands on the suggestions list with the
  // question echoed at the top.
  if (/^(analyze|research|tell me about|what is|show me)/.test(t)) {
    return { kind: "analyze", question: text };
  }

  // Navigation intents.
  if (/\bswap\b|\bexchange\b|\btrade\b/.test(t)) {
    return { kind: "swap" };
  }
  if (/\bposition/.test(t)) {
    return { kind: "positions" };
  }
  if (/\bpool|liquidity|\blp\b/.test(t)) {
    return { kind: "pools" };
  }

  return null;
}

function handleChatCommand(text: string, setRoute: (r: Route) => void) {
  const next = detectIntent(text);
  if (next) {
    setRoute(next);
    return;
  }
  // Fallback: drop the user into the analyze panel so they at least
  // see the suggestion buttons rather than nothing happening.
  setRoute({ kind: "analyze", question: text });
}
