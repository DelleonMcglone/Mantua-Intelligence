import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useCurrentChainId } from "./lib/chain-context.tsx";
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
import type { HookName } from "./features/liquidity/use-create-pool.ts";
import { LiquidityListPage } from "./features/liquidity/LiquidityListPage.tsx";
import { PoolDetailPage } from "./features/liquidity/PoolDetailPage.tsx";
import { PositionsList } from "./features/liquidity/PositionsList.tsx";

type AnalyzeTopic =
  | "eth-price"
  | "eurc-peg"
  | "usdc-eurc-pool"
  | "top-stablecoins"
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
      hook?: HookName | null;
      amountIn?: string;
      /** Bumped on every chat command so the panel remounts and re-applies
       *  the parsed tokens/hook/amount even when the route is otherwise
       *  identical — otherwise a repeated "swap USDC for EURC" does nothing. */
      nonce?: number;
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
          // While the agent panel is open, the global bar drives the agent
          // conversation instead of route-navigating. CircleAgentChat listens
          // for this event (it has no input of its own).
          if (route.kind === "agent") {
            window.dispatchEvent(new CustomEvent("mantua:agent-input", { detail: text }));
            return;
          }
          // While the analyze thread is open, forward input to it so the
          // conversation appends a turn instead of remounting the panel.
          if (route.kind === "analyze") {
            window.dispatchEvent(new CustomEvent("mantua:analyze-input", { detail: text }));
            return;
          }
          handleChatCommand(text, setRoute);
        }}
      />
    </Card>
  );
}

function RouteContent({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  const chainId = useCurrentChainId();
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
        />
      );
    case "swap":
      return (
        <SwapPanel
          // Remount per command so a fresh "swap …" re-applies tokens/hook/
          // amount even when the resulting route looks identical.
          key={`swap-${String(route.nonce ?? 0)}`}
          {...(route.tokenIn ? { initialTokenIn: route.tokenIn } : {})}
          {...(route.tokenOut ? { initialTokenOut: route.tokenOut } : {})}
          {...(route.hook ? { initialHook: route.hook } : {})}
          {...(route.amountIn ? { initialAmount: route.amountIn } : {})}
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
      // Key on chainId so a network switch remounts the form and the
      // useState initializers re-pick chain-aware defaults.
      return (
        <AddLiquidityForm
          key={chainId}
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
      // No remount key: the panel is a persistent conversation thread. The
      // first query seeds turn 1 from these props; later input arrives via the
      // `mantua:analyze-input` event (see InputBar above) and appends.
      return (
        <AnalyzePanel
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
 * Re-export of the pure intent matcher from `lib/chat-intent.ts`.
 * The returned `Intent` goes through `intentToRoute()` below to land
 * on a concrete `Route` — the two unions don't line up shape-for-
 * shape (Intent has create-pool / remove-liquidity / send / portfolio
 * kinds that collapse into a smaller Route set).
 */
function detectIntent(text: string): Intent | null {
  return detectIntentImpl(text);
}

function handleChatCommand(text: string, setRoute: (r: Route) => void) {
  const next = detectIntent(text);
  if (next) {
    setRoute(intentToRoute(next));
    return;
  }
  // Fallback: drop the user into the analyze panel so they at least
  // see the suggestion buttons rather than nothing happening.
  setRoute({ kind: "analyze", question: text });
}

/**
 * Map a parsed `Intent` (from the chat NLP layer) onto a concrete
 * `Route` (what `RouteContent` knows how to render). Most Intent kinds
 * have a 1:1 Route counterpart; the kinds that don't yet collapse to
 * the closest existing panel:
 *
 * - `create-pool` → `add-liquidity` — the AddLiquidityForm already
 *   handles create-or-add via its calldata flow (initialize the pool
 *   if missing, then add liquidity).
 * - `remove-liquidity` → `positions` — per-position deep-linking
 *   needs a pool/position id we don't extract yet; PositionsList lets
 *   the user pick which position to remove.
 * - `send` → `agent` — the conversational agent handles sends.
 * - `portfolio` → `home` — HomeMenu already surfaces PortfolioCard
 *   + AssetsCard.
 *
 * As deep-link surfaces land (send Route, etc.), the corresponding
 * `case` here is the only place that needs to change — the parser
 * is already producing the richer intent.
 */
// Monotonic id so each chat command yields a distinct swap route, forcing
// the swap panel to remount and re-apply the parsed tokens/hook/amount.
let swapNonce = 0;
function nextSwapNonce(): number {
  swapNonce += 1;
  return swapNonce;
}

function intentToRoute(intent: Intent): Route {
  switch (intent.kind) {
    case "home":
      return { kind: "home" };
    case "swap":
      return {
        kind: "swap",
        ...(intent.tokenIn ? { tokenIn: intent.tokenIn } : {}),
        ...(intent.tokenOut ? { tokenOut: intent.tokenOut } : {}),
        // Only forward an explicitly-named hook; otherwise let the panel
        // pick its pair recommendation.
        ...(intent.hook ? { hook: intent.hook } : {}),
        ...(intent.amountIn ? { amountIn: intent.amountIn } : {}),
        nonce: nextSwapNonce(),
      };
    case "pools":
      return { kind: "pools" };
    case "add-liquidity":
    case "create-pool":
      return intent.ctx ? { kind: "add-liquidity", ctx: intent.ctx } : { kind: "add-liquidity" };
    case "remove-liquidity":
      return { kind: "positions" };
    case "positions":
      return { kind: "positions" };
    case "send":
      return { kind: "agent" };
    case "portfolio":
      return { kind: "home" };
    case "analyze":
      return {
        kind: "analyze",
        ...(intent.topic ? { topic: intent.topic } : {}),
        ...(intent.question ? { question: intent.question } : {}),
        ...(intent.symbol ? { symbol: intent.symbol } : {}),
      };
  }
}
