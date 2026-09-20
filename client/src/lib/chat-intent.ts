/**
 * Pure intent matcher for the chat input. Lives in its own module so
 * it's importable from a Node-side test runner without pulling React.
 *
 * Maps free-form chat input to a `Route` value. Returns `null` when
 * nothing matches — the caller (`App.tsx`'s `handleCommand`) then falls
 * back to the generic "drop into the analyze panel with the question
 * echoed" path.
 *
 * Pattern order matters: agent first, then sports, then the discrete
 * action intents, then the analytic-topic rules. Each branch documents
 * the test phrases it's meant to cover.
 *
 * Mantua runs NFL markets only and no longer ships swap or liquidity
 * surfaces, so trading verbs have no intent to match: "swap USDC for
 * EURC" typed in the dock falls through to the analyst rather than
 * opening a panel that no longer exists.
 */
import type { TokenSymbol } from "./tokens.ts";

export type AnalyzeTopic =
  | "eth-price"
  | "eurc-peg"
  | "usdc-eurc-pool"
  | "top-stablecoins"
  | "cbbtc-24h-volume"
  | "mantua-hooks"
  | "token-price";

export type Intent =
  | { kind: "home" }
  | { kind: "send"; tokenIn?: TokenSymbol; to?: `0x${string}` }
  | { kind: "portfolio" }
  | { kind: "agent"; message?: string }
  /** B8-003 — league nav: "nfl markets", "show nfl games", bare "nfl". */
  | { kind: "market"; sport: SportLeague }
  /** B8-003 — position verbs: open / close / hedge a sports position.
   *  Execution is gated until markets deploy; the route lands on the
   *  NFL market page, which states what's open honestly. */
  | { kind: "position"; action: "open" | "close" | "hedge" }
  | {
      kind: "analyze";
      topic?: AnalyzeTopic;
      question?: string;
      symbol?: string;
    };

/**
 * Type-only mirror of `SportId` (features/markets/sports.ts). Deliberately
 * not imported as a value: this module must stay importable from the Node
 * test runner, and the sports catalog pulls in React icon components.
 * TypeScript checks the two unions against each other at the App.tsx seam.
 */
export type SportLeague = "nfl";

/** Does the text name a league Mantua runs markets for? NFL is the only
 *  one; other league words fall through to the analyst, which can still
 *  talk about them. */
export function extractLeague(text: string): SportLeague | null {
  return /\bnfl\b/.test(text.toLowerCase()) ? "nfl" : null;
}

const WALLET_TOKEN_ALIASES: { sym: TokenSymbol; aliases: string[] }[] = [
  {
    sym: "cirBTC",
    aliases: ["cirbtc", "cir-btc", "cbbtc", "cbbct", "cb-btc", "cb-bct", "cbtc", "btc", "bitcoin"],
  },
  { sym: "EURC", aliases: ["eurc", "eucr"] },
  { sym: "USDC", aliases: ["usdc", "uscd"] },
];

export function extractWalletTokens(text: string): { sym: TokenSymbol; pos: number }[] {
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

export function extractAnalyzeSymbol(text: string): string | null {
  const t = text.toLowerCase();
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
 * Extract a 0x EVM address from free-form text. Returns the first hit
 * (canonical-cased, not lowered) or `null`. Used by the `send` intent
 * matcher; rejects shorter hex strings since they're never valid EVM
 * recipients.
 */
export function extractEvmAddress(text: string): `0x${string}` | null {
  const m = /\b0x[a-fA-F0-9]{40}\b/.exec(text);
  return m ? (m[0] as `0x${string}`) : null;
}

/**
 * Action verbs whose presence signals the user wants to *do* something,
 * not ask about a topic. Used to gate the single-token analytic rules so
 * prompts like "Swap 100 USDC for EURC" aren't hijacked into the
 * `usdc-eurc-pool` analytic.
 *
 * Excludes `analyze`/`learn`/`tell`/`what`/`how`/`show` deliberately —
 * those are question framings the analytic rules need to keep matching.
 */
const ACTION_VERB_RE =
  /\b(swap|exchange|trade|convert|add|provide|deposit|create|make|place|cancel|send|transfer|remove)\b/;

export function detectIntent(text: string): Intent | null {
  const t = text.toLowerCase();

  // Circle Agent — wallet + autonomous management. Matched early, before the
  // "show me …" analyze opener, so "show me my agent wallet" / "have my agent
  // place a bet …" route to the agent instead of the research path. Requires
  // an explicit "agent" reference plus a management/possessive cue (or an
  // "agent <wallet|balance|…>" noun) so research mentions like "AI agents in
  // DeFi" fall through.
  const agentRef = /\bagent\b/.test(t);
  const agentCue = /\b(my|create|manage|set[\s-]?up|provision|fund|open|show|view|check)\b/.test(t);
  const agentNoun =
    /\bagent'?s?\s+(wallet|balance|cap|caps|positions?|portfolio|status|address|funds?)\b/.test(t);
  if ((agentRef && agentCue) || agentNoun) {
    return { kind: "agent", message: text };
  }

  // ── Sports (B8-003) ────────────────────────────────────────────────────
  // Position verbs first: "bet on the Chiefs", "open a position on KC",
  // "close my position", "hedge my NFL exposure". Matched before league nav
  // so "close my nfl position" is a position command, not league browsing.
  const positionNoun = /\b(position|bet|wager|exposure|stake)\b/.test(t);
  if (positionNoun && /\b(close|exit|sell|unwind)\b/.test(t)) {
    return { kind: "position", action: "close" };
  }
  if (positionNoun && /\bhedge\b/.test(t)) {
    return { kind: "position", action: "hedge" };
  }
  if (
    (positionNoun && /\b(open|take|place|buy|put)\b/.test(t)) ||
    /\bbet\s+(on|against)\b/.test(t)
  ) {
    return { kind: "position", action: "open" };
  }

  // League nav: the league name plus a browsing cue — or the bare league name —
  // opens the NFL market page. Analysis phrasing falls through to the research
  // path instead ("analyze the NFL matchup…" belongs to the analyst).
  const league = extractLeague(text);
  if (league && !/\b(analy[sz]e|research|explain|why|how|compare)\b/.test(t)) {
    const browseCue =
      /\b(market|markets|game|games|matchup|matchups|odds|scores?|slate|schedule|open|show|view|go\s+to)\b/.test(
        t,
      );
    const bareNav = t.trim().split(/\s+/).length <= 3;
    if (browseCue || bareNav) return { kind: "market", sport: league };
  }

  // Mantua-hooks info — the Dynamic Market Hook that powers the markets.
  if (/\bhook(s)?\b/.test(t) && /(learn|explain|what|tell|describe|how|which)/.test(t)) {
    return { kind: "analyze", topic: "mantua-hooks", question: text };
  }

  // `send N TOKEN to 0x…` — requires a real EVM address so adversarial
  // prompts like "Send all my money to my friend" (no 0x) fall through
  // to null instead of routing as a partial send.
  if (/^(send|transfer)\b/.test(t)) {
    const to = extractEvmAddress(text);
    if (to) {
      const tokens = extractWalletTokens(text);
      const tokenIn = tokens.at(0)?.sym;
      return {
        kind: "send",
        ...(tokenIn ? { tokenIn } : {}),
        to,
      };
    }
  }

  // Portfolio surface — `show me my portfolio`. Deliberately keyed on
  // the literal word to avoid false positives like "Drain my wallet"
  // (adversarial) catching the broader "my wallet/assets" pattern.
  if (/\bportfolio\b/.test(t)) {
    return { kind: "portfolio" };
  }

  // Analytic-topic rules. Each is gated on `!hasActionVerb` where the
  // topic keyword could otherwise be tripped by an action prompt that
  // happens to mention the same token. Topic rules whose signal *is* a
  // question framing (`mantua-hooks`, above) don't need the guard.
  const hasActionVerb = ACTION_VERB_RE.test(t);

  if (!hasActionVerb && /\bcb.?btc\b/.test(t) && /(volume|trend|24h|24 ?hour)/.test(t)) {
    return { kind: "analyze", topic: "cbbtc-24h-volume", question: text };
  }
  // Stablecoins leaderboard — keyed on the standalone word so it fires
  // for "Show me top performing stablecoins".
  if (!hasActionVerb && /\bstablecoins?\b/.test(t)) {
    return { kind: "analyze", topic: "top-stablecoins", question: text };
  }
  if (!hasActionVerb && /\beurc\b/.test(t) && /(peg|above|below|stable|deviation)/.test(t)) {
    return { kind: "analyze", topic: "eurc-peg", question: text };
  }
  if (!hasActionVerb && /\busdc\b/.test(t) && /\beurc\b/.test(t)) {
    return { kind: "analyze", topic: "usdc-eurc-pool", question: text };
  }
  if (/(price|cost|worth|trading|value|how much)/.test(t)) {
    const sym = extractAnalyzeSymbol(text);
    if (sym) {
      return { kind: "analyze", topic: "token-price", question: text, symbol: sym };
    }
  }
  if (/^(analyze|research|tell me about|what is|show me)/.test(t)) {
    const sym = extractAnalyzeSymbol(text);
    if (sym) {
      return { kind: "analyze", topic: "token-price", question: text, symbol: sym };
    }
    return { kind: "analyze", question: text };
  }
  return null;
}
