import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { TokenSymbol } from "./lib/tokens.ts";
import { detectIntent as detectIntentImpl, type Intent } from "./lib/chat-intent.ts";
import { LandingPage } from "./components/landing/LandingPage.tsx";
import { AppShell } from "./components/shell/AppShell.tsx";
import { Card } from "./components/shell/Card.tsx";
import { HomeMenu, type HomePromptId } from "./components/shell/HomeMenu.tsx";
import { InputBar } from "./components/shell/InputBar.tsx";
import { AgentPanel } from "./features/agent/AgentPanel.tsx";
import { AnalyzePanel } from "./features/analyze/AnalyzePanel.tsx";
import { PortfolioCard } from "./features/portfolio/PortfolioCard.tsx";
import { AssetsCard } from "./features/portfolio/AssetsCard.tsx";
import { AssetDetailPanel } from "./features/portfolio/AssetDetailPanel.tsx";
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
  | "mantua-hooks"
  | "token-price";

type Route =
  | { kind: "landing" }
  | { kind: "home" }
  | {
      kind: "swap";
      tokenIn?: TokenSymbol;
      tokenOut?: TokenSymbol;
    }
  | { kind: "pools" }
  | { kind: "pool"; id: string }
  | { kind: "add-liquidity"; ctx?: PoolKeyContext }
  | { kind: "positions" }
  | { kind: "asset"; symbol: TokenSymbol }
  | {
      kind: "analyze";
      topic?: AnalyzeTopic;
      question?: string;
      /** Free-form symbol to pass to the `token-price` runner. */
      symbol?: string;
    }
  | { kind: "agent" };

export default function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [route, setRoute] = useState<Route>({ kind: "landing" });

  // PanelHeader's "New chat" button (rendered inside every panel)
  // falls back to this event when no `onNewChat` prop is wired —
  // letting any panel reset to the home menu without prop-drilling.
  useEffect(() => {
    const handler = () => {
      setRoute({ kind: "home" });
    };
    window.addEventListener("mantua:new-chat", handler);
    return () => {
      window.removeEventListener("mantua:new-chat", handler);
    };
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen bg-bg text-text flex items-center justify-center">
        <p className="text-sm text-text-dim">Loading…</p>
      </main>
    );
  }

  // Landing page is the default surface — public marketing copy with
  // no Privy auth attached. "Launch Demo" buttons hand off to the
  // existing in-app shell by flipping the route to `home`.
  if (route.kind === "landing") {
    return (
      <LandingPage
        onLaunch={() => {
          setRoute({ kind: "home" });
        }}
      />
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
      onLogoClick={() => {
        setRoute({ kind: "landing" });
      }}
      left={<LeftColumn setRoute={setRoute} />}
      right={<RightColumn route={route} setRoute={setRoute} />}
    />
  );
}

function LeftColumn({ setRoute }: { setRoute: (r: Route) => void }) {
  return (
    <>
      <PortfolioCard />
      <AssetsCard
        onSelectPool={(id) => {
          setRoute({ kind: "pool", id });
        }}
        onSelectAsset={(symbol) => {
          setRoute({ kind: "asset", symbol });
        }}
      />
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
          {...(route.tokenIn ? { initialTokenIn: route.tokenIn } : {})}
          {...(route.tokenOut ? { initialTokenOut: route.tokenOut } : {})}
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
    case "asset":
      return (
        <AssetDetailPanel
          key={route.symbol}
          symbol={route.symbol}
          onClose={() => {
            setRoute({ kind: "home" });
          }}
        />
      );
    case "analyze":
      // Key on topic+question+symbol so submitting a fresh query while
      // already on the analyze panel remounts with the new initial
      // state — otherwise the seeded useState wouldn't update.
      return (
        <AnalyzePanel
          key={`${route.topic ?? "none"}|${route.question ?? ""}|${route.symbol ?? ""}`}
          {...(route.topic ? { initialTopic: route.topic } : {})}
          {...(route.question ? { initialQuestion: route.question } : {})}
          {...(route.symbol ? { initialSymbol: route.symbol } : {})}
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
 * Thin adapter from the pure intent matcher (`lib/chat-intent.ts`)
 * to the App's `Route` discriminated union. Lives here because
 * `Route` references `PoolKeyContext` from the AddLiquidityForm,
 * which would pull React types into the otherwise-pure intent
 * module if we collapsed them. The shapes line up byte-for-byte —
 * this is just a re-cast.
 */
function detectIntent(text: string): Route | null {
  const intent: Intent | null = detectIntentImpl(text);
  if (!intent) return null;
  return intent;
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
