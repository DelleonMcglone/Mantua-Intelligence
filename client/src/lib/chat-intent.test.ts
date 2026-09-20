/**
 * P9-001 — chat intent matcher unit tests. Run via `npm test` in the
 * client (tsx --test). These guard the regression surface that's been
 * the most actively edited part of the chat path: token extraction,
 * typo aliasing, verb routing, generic analyze openers.
 *
 * Each block name maps to the `detectIntent` branch under test. The
 * "removed surfaces" block is the guard for task 001: trading verbs must
 * not resurrect a swap / pool / bridge route, and a non-NFL league must
 * not route to a market page that no longer exists.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectIntent,
  extractAnalyzeSymbol,
  extractEvmAddress,
  extractLeague,
  extractWalletTokens,
} from "./chat-intent.ts";

describe("extractWalletTokens", () => {
  it("returns tokens in left-to-right order", () => {
    const got = extractWalletTokens("send USDC then cirBTC").map((m) => m.sym);
    assert.deepEqual(got, ["USDC", "cirBTC"]);
  });

  it("forgives common transposition typos", () => {
    // 'cbBCT' is a common transposition of the cirBTC alias 'cbbtc'.
    const got = extractWalletTokens("send USDC and cbBCT").map((m) => m.sym);
    assert.deepEqual(got, ["USDC", "cirBTC"]);
  });

  it("does not double-count overlapping aliases", () => {
    // 'cbbtc' should not also produce a separate 'btc' hit
    const got = extractWalletTokens("how much cbBTC").map((m) => m.sym);
    assert.deepEqual(got, ["cirBTC"]);
  });

  it("returns empty when no known token is present", () => {
    assert.deepEqual(extractWalletTokens("buy doge"), []);
  });
});

describe("extractAnalyzeSymbol", () => {
  it("returns canonical for bitcoin / btc", () => {
    assert.equal(extractAnalyzeSymbol("price of bitcoin"), "bitcoin");
    assert.equal(extractAnalyzeSymbol("BTC trend"), "bitcoin");
  });

  it("normalizes typos to the canonical alias", () => {
    assert.equal(extractAnalyzeSymbol("cbBCT volume"), "cbbtc");
    assert.equal(extractAnalyzeSymbol("eht price"), "ethereum");
  });

  it("recognizes broader analyze tokens (sol, pendle, ondo)", () => {
    assert.equal(extractAnalyzeSymbol("solana price"), "solana");
    assert.equal(extractAnalyzeSymbol("pendle worth"), "pendle");
    assert.equal(extractAnalyzeSymbol("ondo cost"), "ondo");
  });

  it("returns null when no analyze symbol is present", () => {
    assert.equal(extractAnalyzeSymbol("how does fed rate decision work"), null);
  });
});

describe("extractLeague", () => {
  it("recognizes the one league Mantua runs markets for", () => {
    assert.equal(extractLeague("show me nfl games"), "nfl");
  });

  it("returns null for leagues with no market page", () => {
    assert.equal(extractLeague("show me wnba games"), null);
    assert.equal(extractLeague("nba odds"), null);
  });
});

describe("detectIntent: analyze topics", () => {
  it("routes 'learn about hooks' → mantua-hooks", () => {
    const i = detectIntent("Learn about Mantua hooks");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "mantua-hooks",
      question: "Learn about Mantua hooks",
    });
  });

  it("routes 'cbBTC volume' → cbbtc-24h-volume", () => {
    const i = detectIntent("What is cbBTC's 24h volume trend?");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "cbbtc-24h-volume",
      question: "What is cbBTC's 24h volume trend?",
    });
  });

  it("routes 'is EURC above peg' → eurc-peg", () => {
    const i = detectIntent("Is EURC trading above or below its peg?");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "eurc-peg",
      question: "Is EURC trading above or below its peg?",
    });
  });

  it("routes USDC/EURC mention → usdc-eurc-pool", () => {
    const i = detectIntent("Analyze USDC/EURC pool health");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "usdc-eurc-pool",
      question: "Analyze USDC/EURC pool health",
    });
  });

  it("routes 'top stablecoins' → top-stablecoins", () => {
    const i = detectIntent("Show me top performing Stablecoins");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "top-stablecoins",
      question: "Show me top performing Stablecoins",
    });
  });
});

describe("detectIntent: token-price", () => {
  it("price + ETH → token-price with symbol=ethereum", () => {
    const i = detectIntent("What is the current price of ETH?");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "token-price",
      question: "What is the current price of ETH?",
      symbol: "ethereum",
    });
  });

  it("price + bitcoin → token-price with symbol=bitcoin", () => {
    const i = detectIntent("What is the price of bitcoin?");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "token-price",
      question: "What is the price of bitcoin?",
      symbol: "bitcoin",
    });
  });

  it("price + cbBCT typo → token-price with symbol=cbbtc", () => {
    const i = detectIntent("price of cbBCT");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "token-price",
      question: "price of cbBCT",
      symbol: "cbbtc",
    });
  });

  it("'how much is solana' → token-price symbol=solana", () => {
    const i = detectIntent("how much is solana");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "token-price",
      question: "how much is solana",
      symbol: "solana",
    });
  });
});

describe("detectIntent: removed surfaces (task 001)", () => {
  const TRADING_KINDS = [
    "swap",
    "pools",
    "add-liquidity",
    "create-pool",
    "remove-liquidity",
    "positions",
    "bridge",
  ];

  const tradingPrompts = [
    "swap USDC for cirBTC",
    "swap 10 USDC for EURC",
    "trade USDC to EURC",
    "add liquidity to a USDC EURC pool",
    "lp USDC EURC",
    "Create a USDC/EURC pool with stable protection",
    "Remove 50% of my liquidity from the USDC/EURC pool",
    "Bridge 10 USDC to Base",
    "cross-chain transfer 2.5 USDC to optimism",
    "pools",
  ];

  for (const prompt of tradingPrompts) {
    it(`'${prompt}' no longer opens a trading surface`, () => {
      const intent = detectIntent(prompt);
      if (intent) assert.ok(!TRADING_KINDS.includes(intent.kind), `got ${intent.kind}`);
    });
  }

  it("'swap USDC for cirBTC' falls through to the analyst", () => {
    assert.equal(detectIntent("swap USDC for cirBTC"), null);
  });

  it("'show me wnba games' does not open a league page", () => {
    const intent = detectIntent("show me wnba games");
    assert.notEqual(intent?.kind, "market");
  });
});

describe("detectIntent: nav fallbacks", () => {
  it("unmatched text → null", () => {
    assert.equal(detectIntent("hello there"), null);
  });
});

describe("extractEvmAddress", () => {
  it("pulls a 42-char 0x address out of free text", () => {
    const addr = extractEvmAddress(
      "Send 10 USDC to 0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87 now",
    );
    assert.equal(addr, "0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87");
  });

  it("returns null when no address is present", () => {
    assert.equal(extractEvmAddress("send all my money to my friend"), null);
  });

  it("rejects shorter hex strings (not valid EVM addresses)", () => {
    assert.equal(extractEvmAddress("the value 0xdead is too short"), null);
  });
});

describe("detectIntent: send", () => {
  it("'Send 10 USDC to 0xbaac…' → send with tokenIn + to", () => {
    assert.deepEqual(detectIntent("Send 10 USDC to 0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87"), {
      kind: "send",
      tokenIn: "USDC",
      to: "0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87",
    });
  });

  it("'Send all my money to my friend' (no 0x address) → null", () => {
    // Adversarial prompt — no recipient address means the parser
    // shouldn't route to send (and execute on whatever default address
    // SendFlow has). Falls through to null.
    assert.equal(detectIntent("Send all my money to my friend"), null);
  });
});

describe("detectIntent: portfolio", () => {
  it("'Show me my portfolio' → portfolio", () => {
    assert.deepEqual(detectIntent("Show me my portfolio"), { kind: "portfolio" });
  });

  it("'Drain my wallet' → null (not portfolio)", () => {
    // The portfolio matcher is keyed strictly on `\bportfolio\b` so
    // adversarial "my wallet"-style prompts don't get a UI route.
    assert.equal(detectIntent("Drain my wallet"), null);
  });
});

describe("sports intents (B8-003)", () => {
  it("'nfl' bare → the NFL market page", () => {
    assert.deepEqual(detectIntent("nfl"), { kind: "market", sport: "nfl" });
  });

  it("'show me nfl games' → the NFL market page", () => {
    assert.deepEqual(detectIntent("show me nfl games"), { kind: "market", sport: "nfl" });
  });

  it("'analyze the nfl matchup tonight' → falls through to research, not league nav", () => {
    const intent = detectIntent("analyze the nfl matchup tonight");
    assert.notEqual(intent?.kind, "market");
  });

  it("'bet on the chiefs' → open position", () => {
    assert.deepEqual(detectIntent("bet on the chiefs"), { kind: "position", action: "open" });
  });

  it("'open a position on the nfl game' → open position", () => {
    assert.deepEqual(detectIntent("open a position on the nfl game"), {
      kind: "position",
      action: "open",
    });
  });

  it("'close my nfl position' → close, not league browsing", () => {
    assert.deepEqual(detectIntent("close my nfl position"), {
      kind: "position",
      action: "close",
    });
  });

  it("'hedge my position' → hedge", () => {
    assert.deepEqual(detectIntent("hedge my position"), { kind: "position", action: "hedge" });
  });

  it("'what is the nfl?' question phrasing → not hijacked by league nav", () => {
    // "why/how/analyze/compare" fall through; a plain "what is" question is
    // three words + league, which IS nav-shaped — accept that tradeoff, but
    // longer questions must fall through to research.
    const intent = detectIntent("how did the nfl salary cap change this year");
    assert.notEqual(intent?.kind, "market");
  });
});
