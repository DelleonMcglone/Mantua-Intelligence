/**
 * P9-001 — `buildPoolKey` unit tests. Guards three invariants that
 * have been the source of multiple production bugs:
 *
 * 1. Token sorting (currency0 < currency1) — v4 requires this.
 * 2. Native ETH (zero address) sorts before any ERC-20.
 * 3. `effectivePoolFee` is applied when `hookName` is passed, so
 *    Stable Protection / Dynamic Fee pools always get
 *    `key.fee = DYNAMIC_FEE_FLAG` and the user's static tier still
 *    drives `tickSpacing`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPoolKey } from "./pool-key.ts";
import { TOKENS, ZERO_ADDRESS } from "./tokens.ts";
import { DYNAMIC_FEE_FLAG } from "./v4-contracts.ts";

describe("buildPoolKey: token sorting", () => {
  it("sorts USDC/EURC into canonical order regardless of arg order", () => {
    const a = buildPoolKey("USDC", "EURC", 100);
    const b = buildPoolKey("EURC", "USDC", 100);
    // Same canonical key, just `flipped` differs.
    assert.equal(a.key.currency0, b.key.currency0);
    assert.equal(a.key.currency1, b.key.currency1);
    assert.equal(a.flipped !== b.flipped, true);
    // currency0 must be strictly less than currency1.
    assert.ok(a.key.currency0 < a.key.currency1, "currency0 must sort before currency1");
  });

  it("native ETH (zero address) sorts before any ERC-20", () => {
    const r = buildPoolKey("ETH", "USDC", 500);
    assert.equal(r.key.currency0, ZERO_ADDRESS);
    assert.equal(r.key.currency1.toLowerCase(), TOKENS.USDC.address.toLowerCase());
    assert.equal(r.flipped, false); // ETH was first arg, no flip
  });

  it("ERC-20 first arg with native second flips correctly", () => {
    const r = buildPoolKey("USDC", "ETH", 500);
    assert.equal(r.key.currency0, ZERO_ADDRESS);
    assert.equal(r.key.currency1.toLowerCase(), TOKENS.USDC.address.toLowerCase());
    assert.equal(r.flipped, true);
  });

  it("throws when both tokens are identical", () => {
    assert.throws(() => buildPoolKey("USDC", "USDC", 100));
  });

  it("returns lowercase addresses (case-insensitive sort invariant)", () => {
    const r = buildPoolKey("USDC", "EURC", 100);
    assert.equal(r.key.currency0, r.key.currency0.toLowerCase());
    assert.equal(r.key.currency1, r.key.currency1.toLowerCase());
  });
});

describe("buildPoolKey: tick spacing from static fee tier", () => {
  it("0.01% (100) → tickSpacing 1", () => {
    assert.equal(buildPoolKey("USDC", "EURC", 100).key.tickSpacing, 1);
  });

  it("0.05% (500) → tickSpacing 10", () => {
    assert.equal(buildPoolKey("USDC", "ETH", 500).key.tickSpacing, 10);
  });

  it("0.30% (3000) → tickSpacing 60", () => {
    assert.equal(buildPoolKey("USDC", "ETH", 3000).key.tickSpacing, 60);
  });

  it("1.00% (10000) → tickSpacing 200", () => {
    assert.equal(buildPoolKey("USDC", "ETH", 10000).key.tickSpacing, 200);
  });
});

describe("buildPoolKey: hook-aware effective fee", () => {
  it("no hook name → key.fee equals static fee", () => {
    const r = buildPoolKey("USDC", "EURC", 100, ZERO_ADDRESS, null);
    assert.equal(r.key.fee, 100);
  });

  it("stable-protection → key.fee == DYNAMIC_FEE_FLAG", () => {
    const r = buildPoolKey(
      "USDC",
      "EURC",
      100,
      "0xe5e6a9e09ad1e536788f0c142ad5bc69e8b020c0",
      "stable-protection",
    );
    assert.equal(r.key.fee, DYNAMIC_FEE_FLAG);
    // tickSpacing still derives from the user's static tier choice.
    assert.equal(r.key.tickSpacing, 1);
  });

  it("dynamic-fee → key.fee == DYNAMIC_FEE_FLAG", () => {
    const r = buildPoolKey(
      "ETH",
      "USDC",
      500,
      "0x9788b8495ebcec1c1d1436681b0f56c6fc0140c0",
      "dynamic-fee",
    );
    assert.equal(r.key.fee, DYNAMIC_FEE_FLAG);
    assert.equal(r.key.tickSpacing, 10);
  });

  it("hook address is encoded into key.hooks verbatim", () => {
    const hook = "0xe5e6a9e09ad1e536788f0c142ad5bc69e8b020c0";
    const r = buildPoolKey("USDC", "EURC", 100, hook, "stable-protection");
    assert.equal(r.key.hooks, hook);
  });
});
