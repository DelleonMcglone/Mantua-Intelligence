/**
 * P9-001 — chat intent matcher unit tests. Run via `npm test` in the
 * client (tsx --test). These guard the regression surface that's been
 * the most actively edited part of the chat path: token extraction,
 * typo aliasing, verb routing, generic analyze openers.
 *
 * Each block name maps to the `detectIntent` branch under test.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectIntent,
  extractAnalyzeSymbol,
  extractWalletTokens,
} from "./chat-intent.ts";

describe("extractWalletTokens", () => {
  it("returns tokens in left-to-right order", () => {
    const got = extractWalletTokens("swap ETH for cbBTC").map((m) => m.sym);
    assert.deepEqual(got, ["ETH", "cbBTC"]);
  });

  it("forgives common transposition typos", () => {
    const got = extractWalletTokens("swap ETH for cbBCT").map((m) => m.sym);
    assert.deepEqual(got, ["ETH", "cbBTC"]);
  });

  it("does not double-count overlapping aliases", () => {
    // 'cbbtc' should not also produce a separate 'btc' hit
    const got = extractWalletTokens("how much cbBTC").map((m) => m.sym);
    assert.deepEqual(got, ["cbBTC"]);
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

  it("routes USDC/USDT mention → usdc-usdt-pool", () => {
    const i = detectIntent("Analyze USDC/USDT pool health");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "usdc-usdt-pool",
      question: "Analyze USDC/USDT pool health",
    });
  });

  it("routes 'top RWA tokens' → top-rwa-tokens", () => {
    const i = detectIntent("Show me top performing RWA tokens");
    assert.deepEqual(i, {
      kind: "analyze",
      topic: "top-rwa-tokens",
      question: "Show me top performing RWA tokens",
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

describe("detectIntent: swap", () => {
  it("'swap ETH for cbBTC' extracts tokenIn=ETH, tokenOut=cbBTC", () => {
    assert.deepEqual(detectIntent("swap ETH for cbBTC"), {
      kind: "swap",
      tokenIn: "ETH",
      tokenOut: "cbBTC",
    });
  });

  it("'swap ETH for cbBCT' (typo) still extracts cbBTC", () => {
    assert.deepEqual(detectIntent("swap ETH for cbBCT"), {
      kind: "swap",
      tokenIn: "ETH",
      tokenOut: "cbBTC",
    });
  });

  it("'trade USDC to EURC'", () => {
    assert.deepEqual(detectIntent("trade USDC to EURC"), {
      kind: "swap",
      tokenIn: "USDC",
      tokenOut: "EURC",
    });
  });

  it("single-token swap → tokenIn pre-filled", () => {
    assert.deepEqual(detectIntent("swap eth"), {
      kind: "swap",
      tokenIn: "ETH",
    });
  });

  it("verb only → swap with no token presets", () => {
    assert.deepEqual(detectIntent("swap stablecoins"), { kind: "swap" });
  });
});

describe("detectIntent: add-liquidity", () => {
  it("'add liquidity to USDC/EURC pool' → add-liquidity ctx", () => {
    assert.deepEqual(detectIntent("add liquidity to a USDC EURC pool"), {
      kind: "add-liquidity",
      ctx: { tokenA: "USDC", tokenB: "EURC", fee: 100, hook: undefined },
    });
  });

  it("'add liquidity to ETH cbBCT' (typo) extracts both tokens", () => {
    assert.deepEqual(detectIntent("add liquidity to a ETH cbBCT pool"), {
      kind: "add-liquidity",
      ctx: { tokenA: "ETH", tokenB: "cbBTC", fee: 500, hook: undefined },
    });
  });

  it("'lp USDC EURC' (LP shorthand)", () => {
    assert.deepEqual(detectIntent("lp USDC EURC"), {
      kind: "add-liquidity",
      ctx: { tokenA: "USDC", tokenB: "EURC", fee: 100, hook: undefined },
    });
  });

  it("'add liquidity' with no token pair → pools fallback", () => {
    assert.deepEqual(detectIntent("add liquidity"), { kind: "pools" });
  });
});

describe("detectIntent: nav fallbacks", () => {
  it("'show my positions' → positions", () => {
    assert.deepEqual(detectIntent("show my positions"), { kind: "positions" });
  });

  it("'pools' bare → pools", () => {
    assert.deepEqual(detectIntent("pools"), { kind: "pools" });
  });

  it("unmatched text → null", () => {
    assert.equal(detectIntent("hello there"), null);
  });
});
