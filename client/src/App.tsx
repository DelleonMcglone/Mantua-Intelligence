/**
 * Top-level route table and command router.
 *
 * `/` is the home page — today's NFL board plus the prompt cards — for
 * every visitor, logged in or out (decision D-121). There is no landing
 * interstitial; the login gate lives at the trade ticket (B5-007), never
 * in front of browsing.
 */
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { detectIntent as detectIntentImpl, type Intent } from "./lib/chat-intent.ts";
import type { TokenSymbol } from "./lib/tokens.ts";
import { LoginModal } from "./components/auth/LoginModal.tsx";
import { type NavDestination } from "./components/shell/MarketNav.tsx";
import { PrivacyPage } from "./components/legal/PrivacyPage.tsx";
import { TermsPage } from "./components/legal/TermsPage.tsx";
import { MarketIntegrityPage } from "./components/legal/MarketIntegrityPage.tsx";
import type { LegalDoc } from "./components/legal/LegalPage.tsx";
import { DocsPage } from "./components/docs/DocsPage.tsx";
import { LeaguePage } from "./features/markets/LeaguePage.tsx";
import { isSportId, type SportId } from "./features/markets/sports.ts";
import { AppShell } from "./components/shell/AppShell.tsx";
import { Card } from "./components/shell/Card.tsx";
import { Footer } from "./components/shell/Footer.tsx";
import { HomePromptRow, type HomePromptId } from "./components/shell/HomeMenu.tsx";
import { InputBar } from "./components/shell/InputBar.tsx";
import { AgentPanel } from "./features/agent/AgentPanel.tsx";
import { AnalyzePanel } from "./features/analyze/AnalyzePanel.tsx";
import { PortfolioCard } from "./features/portfolio/PortfolioCard.tsx";
import { ProfilePage } from "./features/portfolio/ProfilePage.tsx";
import { Board } from "./features/markets/Board.tsx";
import { AssetsCard } from "./features/portfolio/AssetsCard.tsx";
import { AssetDetailPanel } from "./features/portfolio/AssetDetailPanel.tsx";

type AnalyzeTopic =
  | "eth-price"
  | "eurc-peg"
  | "usdc-eurc-pool"
  | "top-stablecoins"
  | "cbbtc-24h-volume"
  | "mantua-hooks"
  | "token-price";

type Route =
  | { kind: "legal"; doc: LegalDoc }
  | { kind: "docs" }
  | { kind: "home" }
  | { kind: "market"; sport: SportId; selectEventId?: string; direction?: "buy" | "sell" }
  | { kind: "profile" }
  | { kind: "asset"; symbol: TokenSymbol }
  | {
      kind: "analyze";
      topic?: AnalyzeTopic;
      question?: string;
      /** Free-form symbol to pass to the `token-price` runner. */
      symbol?: string;
    }
  | { kind: "agent"; message?: string };

// Intents the agent executes itself; everything else is a navigation.
const AGENT_ACTION_KINDS = new Set<Intent["kind"]>(["send"]);

// ─── Route persistence ────────────────────────────────────────────────────────
// The route lives only in React state, so a refresh would otherwise bounce
// back to the home page. Persist the last in-app route to sessionStorage and
// restore it on load: refresh keeps your place.
const ROUTE_STORAGE_KEY = "mantua:last-route";
const RESTORABLE_KINDS: readonly Route["kind"][] = [
  "home",
  "market",
  "profile",
  "asset",
  "analyze",
  "agent",
];

/** What we persist. Never store the public pages — legal and docs —
 *  (clear instead), and never store an agent `message`: restoring it would
 *  auto-resend the command on refresh (potentially re-executing a trade). */
function sanitizeRouteForStorage(route: Route): Route | null {
  if (route.kind === "legal" || route.kind === "docs") return null;
  if (route.kind === "agent") return { kind: "agent" };
  return route;
}

/**
 * Read the persisted route, rejecting anything this build no longer
 * serves. A tab left open across the trading removal holds a `swap` or
 * `pools` kind; `RESTORABLE_KINDS` drops it and the visitor lands home
 * rather than on a blank shell.
 */
function loadStoredRoute(): Route | null {
  try {
    const raw = sessionStorage.getItem(ROUTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { kind?: unknown; sport?: unknown };
    if (
      typeof parsed.kind === "string" &&
      (RESTORABLE_KINDS as readonly string[]).includes(parsed.kind)
    ) {
      // A market route is only restorable with a league we still ship.
      if (parsed.kind === "market" && !isSportId(parsed.sport)) return null;
      return parsed as Route;
    }
  } catch {
    // Corrupt / unavailable storage → start fresh at home.
  }
  return null;
}

export default function App() {
  const { ready, authenticated, logout, user } = usePrivy();
  const [route, setRoute] = useState<Route>(() => loadStoredRoute() ?? { kind: "home" });
  const [showLogin, setShowLogin] = useState(false);

  // Any surface can request the login modal without prop-drilling —
  // league-page and dock gate buttons dispatch this event.
  useEffect(() => {
    const handler = () => {
      setShowLogin(true);
    };
    window.addEventListener("mantua:open-login", handler);
    return () => {
      window.removeEventListener("mantua:open-login", handler);
    };
  }, []);

  // Close-position deep-link from the profile's positions list: open the
  // league page with that game selected and the sidebar on Sell.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ league?: string; eventId?: string }>).detail;
      if (detail.league && isSportId(detail.league) && detail.eventId) {
        setRoute({
          kind: "market",
          sport: detail.league,
          selectEventId: detail.eventId,
          direction: "sell",
        });
      }
    };
    window.addEventListener("mantua:close-position", handler);
    return () => {
      window.removeEventListener("mantua:close-position", handler);
    };
  }, []);

  // Keep the stored route in sync so a refresh restores the current view.
  useEffect(() => {
    try {
      const sanitized = sanitizeRouteForStorage(route);
      if (sanitized) sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(sanitized));
      else sessionStorage.removeItem(ROUTE_STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode etc.) — refresh just returns home.
    }
  }, [route]);

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

  if (route.kind === "docs") {
    return (
      <DocsPage
        onBack={() => {
          setRoute({ kind: "home" });
        }}
      />
    );
  }

  // Legal pages are public and standalone — own header, back to home.
  if (route.kind === "legal") {
    const back = () => {
      setRoute({ kind: "home" });
    };
    switch (route.doc) {
      case "privacy":
        return <PrivacyPage onBack={back} />;
      case "terms":
        return <TermsPage onBack={back} />;
      case "integrity":
        return <MarketIntegrityPage onBack={back} />;
    }
  }

  const walletAddress = user?.wallet?.address;

  const handleConnect = () => {
    setShowLogin(true);
  };
  const handleDisconnect = () => {
    void logout();
  };

  // The universal command router — the dock at the bottom of every page
  // feeds this. A command only starts a mode, it never locks it: every
  // submission re-detects intent and routes to the right surface.
  const handleCommand = (text: string) => {
    // Freemium chat (owner decision 2026-08-18): logged-out users may ask
    // the ANALYST — three free questions, enforced server-side — but any
    // actionable command (agent, market position…) demands login here.
    if (!authenticated) {
      const guest = detectIntent(text);
      if (!guest || guest.kind === "analyze") {
        setRoute(guest ? intentToRoute(guest) : { kind: "analyze", question: text });
        return;
      }
      setShowLogin(true);
      return;
    }
    const intent = detectIntent(text);
    if (route.kind === "agent") {
      window.dispatchEvent(new CustomEvent("mantua:agent-input", { detail: text }));
      return;
    }
    if (intent && (AGENT_ACTION_KINDS.has(intent.kind) || intent.kind === "agent")) {
      setRoute({ kind: "agent", message: text });
      return;
    }
    if (route.kind === "analyze" && (!intent || intent.kind === "analyze")) {
      window.dispatchEvent(new CustomEvent("mantua:analyze-input", { detail: text }));
      return;
    }
    if (intent) {
      setRoute(intentToRoute(intent));
      return;
    }
    setRoute({ kind: "analyze", question: text });
  };

  return (
    <>
      <LoginModal
        open={showLogin}
        onClose={() => {
          setShowLogin(false);
        }}
      />
      <AppShell
        walletAddress={walletAddress}
        onLogin={authenticated ? undefined : handleConnect}
        onSignup={authenticated ? undefined : handleConnect}
        onDisconnect={authenticated ? handleDisconnect : undefined}
        onOpenProfile={() => {
          setRoute({ kind: "profile" });
        }}
        onOpenAgent={() => {
          setRoute({ kind: "agent" });
        }}
        onLogoClick={() => {
          setRoute({ kind: "home" });
        }}
        onNavigate={(destination) => {
          setRoute(navDestinationToRoute(destination));
        }}
        full={fullPage(route, setRoute)}
        dock={
          <InputBar
            onSubmit={handleCommand}
            placeholder={
              authenticated
                ? undefined
                : "Ask the analyst — 3 free questions. Log in to trade and do more"
            }
          />
        }
        left={<LeftColumn route={route} setRoute={setRoute} />}
        right={<RightColumn route={route} setRoute={setRoute} />}
      />
    </>
  );
}

function LeftColumn({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  // B6-008 — the portfolio lives inside the profile, not as standalone nav:
  // opening Profile swaps the left column to balances + assets. The asset
  // drill-down keeps it too, since it reads from it.
  if (route.kind === "profile" || route.kind === "asset") {
    return (
      <>
        <PortfolioCard />
        <AssetsCard
          onSelectAsset={(symbol) => {
            setRoute({ kind: "asset", symbol });
          }}
        />
      </>
    );
  }
  // B5-001 — everywhere else, the left column is the board: today's games
  // across the covered leagues, with the chat/panel column alongside
  // (B5-006). Browsing needs no login (B5-007).
  return (
    <Board
      onAnalyze={(question) => {
        // Free for everyone — the server meters 3 anonymous questions/day.
        setRoute({ kind: "analyze", question });
      }}
      onOpenLeague={(sport) => {
        setRoute({ kind: "market", sport: sport.id });
      }}
      onTrade={(sport) => {
        setRoute({ kind: "market", sport: sport.id });
      }}
    />
  );
}

function RightColumn({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  return (
    <Card className="flex-1 flex flex-col p-0 overflow-hidden self-stretch" style={{ padding: 0 }}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <RouteContent route={route} setRoute={setRoute} />
      </div>
    </Card>
  );
}

function RouteContent({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  switch (route.kind) {
    // home / analyze / market / agent render as full-screen pages (see
    // fullPage); these cases exist only because the element tree is still
    // constructed in split mode for every route kind.
    case "home":
    case "analyze":
    case "market":
    case "agent":
      return null;
    case "profile":
      return <ProfileRoute setRoute={setRoute} />;
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
  }
}

/**
 * Full-screen routes (Polymarket-style surfaces): home, league pages, the
 * agent, and the analyst. Everything else keeps the two-column board +
 * panel shell. Returning undefined selects the split layout.
 */
function fullPage(route: Route, setRoute: (r: Route) => void): React.ReactNode | undefined {
  const home = () => {
    setRoute({ kind: "home" });
  };
  switch (route.kind) {
    case "home":
      return <HomeFullPage setRoute={setRoute} />;
    case "market":
      return (
        <LeaguePage
          key={`${route.sport}-${route.selectEventId ?? ""}`}
          sport={route.sport}
          initialEventId={route.selectEventId}
          initialDirection={route.direction}
          onBack={home}
          onAgent={(message) => {
            setRoute({ kind: "agent", message });
          }}
        />
      );
    case "agent":
      return (
        <PanelPage>
          <AgentPanel
            {...(route.message ? { initialMessage: route.message } : {})}
            onClose={home}
          />
        </PanelPage>
      );
    case "analyze":
      // No remount key: the panel is a persistent conversation thread. The
      // first query seeds turn 1 from these props; later input arrives via
      // the `mantua:analyze-input` event (see InputBar above) and appends.
      return (
        <PanelPage>
          <AnalyzePanel
            {...(route.topic ? { initialTopic: route.topic } : {})}
            {...(route.question ? { initialQuestion: route.question } : {})}
            {...(route.symbol ? { initialSymbol: route.symbol } : {})}
            onBack={home}
            onClose={home}
          />
        </PanelPage>
      );
    default:
      return undefined;
  }
}

/** Full-page wrapper for the panels that used to live in the right column —
 *  a centered card; each panel keeps its own header and X-close home. */
function PanelPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-6 py-6">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ padding: 0 }}>
        {children}
      </Card>
    </div>
  );
}

/**
 * Home page — the prompt cards in a row across the top, then today's NFL
 * board, then the footer (HP-003). Chat starts from the dock below.
 */
function HomeFullPage({ setRoute }: { setRoute: (r: Route) => void }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <HomePromptRow
        onPromptSelect={(id) => {
          setRoute(promptToRoute(id));
        }}
      />
      <div className="mt-5 grid items-start gap-5">
        <Board
          onAnalyze={(question) => {
            setRoute({ kind: "analyze", question });
          }}
          onOpenLeague={(sport) => {
            setRoute({ kind: "market", sport: sport.id });
          }}
          onTrade={(sport, eventId) => {
            setRoute({ kind: "market", sport: sport.id, selectEventId: eventId });
          }}
        />
      </div>
      <Footer
        onOpenLegal={(doc) => {
          setRoute({ kind: "legal", doc });
        }}
        onOpenDocs={() => {
          setRoute({ kind: "docs" });
        }}
      />
    </div>
  );
}

/** Profile panel wrapper — owns the Privy handles the page needs. */
function ProfileRoute({ setRoute }: { setRoute: (r: Route) => void }) {
  const { user, logout } = usePrivy();
  return (
    <ProfilePage
      walletAddress={user?.wallet?.address}
      onOpenAgent={() => {
        setRoute({ kind: "agent" });
      }}
      onLogout={() => {
        void logout();
        setRoute({ kind: "home" });
      }}
      onClose={() => {
        setRoute({ kind: "home" });
      }}
    />
  );
}

/** Where each header nav item lands in the app shell. */
function navDestinationToRoute(destination: NavDestination): Route {
  switch (destination.kind) {
    case "market":
      return { kind: "market", sport: destination.sport };
    case "agent":
      return { kind: "agent" };
  }
}

function promptToRoute(id: HomePromptId): Route {
  switch (id) {
    case "analyze":
      return { kind: "analyze" };
    case "agent":
      return { kind: "agent" };
  }
}

/**
 * Re-export of the pure intent matcher from `lib/chat-intent.ts`.
 * The returned `Intent` goes through `intentToRoute()` below to land
 * on a concrete `Route`.
 */
function detectIntent(text: string): Intent | null {
  return detectIntentImpl(text);
}

/**
 * Map a parsed `Intent` (from the chat NLP layer) onto a concrete
 * `Route` (what `RouteContent` / `fullPage` know how to render).
 *
 * Two kinds collapse onto a neighbouring surface:
 *
 * - `send` → `agent` — the conversational agent handles sends.
 * - `portfolio` → `profile` — the profile surfaces PortfolioCard
 *   + AssetsCard.
 */
function intentToRoute(intent: Intent): Route {
  switch (intent.kind) {
    case "home":
      return { kind: "home" };
    case "send":
      return { kind: "agent" };
    case "agent":
      return { kind: "agent", ...(intent.message ? { message: intent.message } : {}) };
    case "portfolio":
      return { kind: "profile" };
    case "market":
      return { kind: "market", sport: intent.sport };
    case "position":
      // B8-004/B8-005 — position execution is gated until the market
      // contracts deploy. Land on the NFL market page, which says
      // honestly what's open.
      return { kind: "market", sport: "nfl" };
    case "analyze":
      return {
        kind: "analyze",
        ...(intent.topic ? { topic: intent.topic } : {}),
        ...(intent.question ? { question: intent.question } : {}),
        ...(intent.symbol ? { symbol: intent.symbol } : {}),
      };
  }
}
