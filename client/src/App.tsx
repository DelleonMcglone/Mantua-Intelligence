import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { TokenSymbol } from "./lib/tokens.ts";
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
  | "mantua-hooks"
  | "token-price";

type Route =
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
 * Known wallet-side token symbols that the swap / add-liquidity
 * routes can pre-fill. Order matters: longer aliases first so
 * "cbBTC" is checked before "BTC" — otherwise "swap ETH for cbBTC"
 * would extract [ETH, BTC] and miss the cbBTC intent.
 *
 * Common typos are folded in (cbBCT for cbBTC, EUCR for EURC, etc.)
 * so the chat input forgives single-character transpositions
 * without needing fuzzy matching.
 */
const WALLET_TOKEN_ALIASES: { sym: TokenSymbol; aliases: string[] }[] = [
  { sym: "cbBTC", aliases: ["cbbtc", "cb-btc", "cbbct", "cb-bct", "cbtc"] },
  { sym: "EURC", aliases: ["eurc", "eucr"] },
  { sym: "USDC", aliases: ["usdc", "uscd"] },
  { sym: "WETH", aliases: ["weth"] },
  { sym: "ETH", aliases: ["eth", "ethereum", "eht"] },
];

/**
 * Find every wallet-side token reference in `text`, in left-to-right
 * order. Returns each `{sym, pos}` so callers can use the order
 * (e.g. "swap ETH for cbBTC" → tokenIn=ETH, tokenOut=cbBTC).
 */
function extractWalletTokens(text: string): { sym: TokenSymbol; pos: number }[] {
  const t = text.toLowerCase();
  const claimed = new Array<boolean>(t.length).fill(false);
  const found: { sym: TokenSymbol; pos: number }[] = [];
  for (const entry of WALLET_TOKEN_ALIASES) {
    for (const alias of entry.aliases) {
      const re = new RegExp(`\\b${alias}\\b`, "g");
      let m;
      while ((m = re.exec(t)) !== null) {
        if (claimed[m.index]) continue;
        for (let i = m.index; i < m.index + alias.length; i++) claimed[i] = true;
        found.push({ sym: entry.sym, pos: m.index });
      }
    }
  }
  return found.sort((a, b) => a.pos - b.pos);
}

/**
 * "Token-ish" extractor for the analyze-price branch. Recognizes more
 * names than `extractWalletTokens` (Bitcoin, Solana, etc.) since the
 * server-side `token-price` runner accepts a wider alias map. Returns
 * the first matched token name verbatim — server normalizes.
 */
function extractAnalyzeSymbol(text: string): string | null {
  const t = text.toLowerCase();
  // Each entry maps the canonical alias used by the server's analyze
  // alias map to a list of patterns we'll match in the chat. Common
  // single-char typos are folded in (cbBCT for cbBTC, eht for eth)
  // so the matcher forgives transpositions without fuzzy matching.
  const candidates: { canonical: string; patterns: string[] }[] = [
    { canonical: "bitcoin", patterns: ["bitcoin", "btc"] },
    { canonical: "ethereum", patterns: ["ethereum", "eth", "eht"] },
    { canonical: "cbbtc", patterns: ["cbbtc", "cbbct", "cb-btc", "cb-bct"] },
    { canonical: "usdc", patterns: ["usdc", "uscd"] },
    { canonical: "usdt", patterns: ["usdt"] },
    { canonical: "eurc", patterns: ["eurc", "eucr"] },
    { canonical: "weth", patterns: ["weth"] },
    { canonical: "solana", patterns: ["solana", "sol"] },
    { canonical: "maker", patterns: ["maker", "mkr"] },
    { canonical: "pendle", patterns: ["pendle"] },
    { canonical: "ondo", patterns: ["ondo"] },
    { canonical: "centrifuge", patterns: ["centrifuge"] },
  ];
  for (const c of candidates) {
    for (const p of c.patterns) {
      const re = new RegExp(`\\b${p}\\b`);
      if (re.test(t)) return c.canonical;
    }
  }
  return null;
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

  // Generic price intent — matches any token name in the analyze
  // alias map (bitcoin, solana, pendle, etc.). Routes to the
  // `token-price` topic with the matched symbol.
  if (/(price|cost|worth|trading|value|how much)/.test(t)) {
    const sym = extractAnalyzeSymbol(text);
    if (sym) {
      return { kind: "analyze", topic: "token-price", question: text, symbol: sym };
    }
  }

  // Generic analyze opener — "analyze X", "research X", "what is X"
  // when no topic matched. Lands on the suggestions list with the
  // question echoed at the top.
  if (/^(analyze|research|tell me about|what is|show me)/.test(t)) {
    // If the opener mentions a known token, still route to a price
    // lookup ("What is bitcoin?" → token-price). Otherwise just
    // open the analyze panel with the question echoed.
    const sym = extractAnalyzeSymbol(text);
    if (sym) {
      return { kind: "analyze", topic: "token-price", question: text, symbol: sym };
    }
    return { kind: "analyze", question: text };
  }

  // Add-liquidity intent — "add liquidity to X/Y", "add to X Y pool",
  // "lp X Y". Pulls the wallet-side token pair out and routes to the
  // unified Add Liquidity / Create Pool form with the pair pre-set.
  if (/\b(add|provide).*(liquidity|lp)\b/.test(t) || /^lp\b/.test(t)) {
    const tokens = extractWalletTokens(text);
    if (tokens.length >= 2) {
      const [a, b] = tokens;
      const fee = isStable(a!.sym) && isStable(b!.sym) ? 100 : 500;
      return {
        kind: "add-liquidity",
        ctx: { tokenA: a!.sym, tokenB: b!.sym, fee, hook: undefined },
      };
    }
    return { kind: "pools" };
  }

  // Swap intent — "swap X for Y" / "swap X to Y" / "trade X for Y".
  // Order matters: tokenIn before tokenOut.
  if (/\b(swap|exchange|trade|convert)\b/.test(t)) {
    const tokens = extractWalletTokens(text);
    if (tokens.length >= 2) {
      const [a, b] = tokens;
      return { kind: "swap", tokenIn: a!.sym, tokenOut: b!.sym };
    }
    if (tokens.length === 1) {
      return { kind: "swap", tokenIn: tokens[0]!.sym };
    }
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

/**
 * Stable-pair check that mirrors `isStable` from the liquidity helpers
 * — kept inline here to avoid a cross-feature import for one bool.
 */
function isStable(s: TokenSymbol): boolean {
  return s === "USDC" || s === "EURC";
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
