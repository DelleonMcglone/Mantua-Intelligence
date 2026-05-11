import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HookPairNotAllowedError,
  assertHookPairAllowed,
  assertHookPairAllowedBySymbol,
  isHookPairAllowed,
  isHookPairAllowedBySymbol,
  listAllowedPairs,
  resolveHookForPool,
} from "./hook-pair-gating.ts";
import { TOKENS, ZERO_ADDRESS } from "./tokens.ts";

const USDC = TOKENS.USDC.address;
const EURC = TOKENS.EURC.address;
const ETH = TOKENS.ETH.address;
const UNKNOWN = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

// Stable Protection's PegMonitor hard-codes a 1:1 peg, so any non-1:1
// pair lands in CRITICAL zone and the hook reverts every swap. Base
// Sepolia has no true 1:1 pair → stable-protection's allowlist is `[]`
// → server rejects pool creation and quoting up front instead of
// burning eth_calls only to surface a wrapped revert.
describe("isHookPairAllowed — stable-protection (empty allowlist)", () => {
  it("rejects USDC/EURC (not 1:1)", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, EURC), false);
    assert.equal(isHookPairAllowedBySymbol("stable-protection", "USDC", "EURC"), false);
    assert.equal(isHookPairAllowedBySymbol("stable-protection", "EURC", "USDC"), false);
  });

  it("rejects USDC/ETH (volatile pair)", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, ETH), false);
  });

  it("rejects unknown token addresses", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, UNKNOWN), false);
  });
});

describe("isHookPairAllowed — unrestricted hooks", () => {
  it("returns true for any pair on dynamic-fee", () => {
    assert.equal(isHookPairAllowed("dynamic-fee", USDC, ETH), true);
    assert.equal(isHookPairAllowed("dynamic-fee", UNKNOWN, UNKNOWN), true);
    assert.equal(isHookPairAllowedBySymbol("dynamic-fee", "USDC", "EURC"), true);
  });

  it("returns true for any pair on rwa-gate", () => {
    assert.equal(isHookPairAllowed("rwa-gate", USDC, ETH), true);
  });

  it("returns true for any pair on async-limit-order", () => {
    assert.equal(isHookPairAllowed("async-limit-order", USDC, ETH), true);
  });
});

describe("listAllowedPairs", () => {
  it("returns [] for stable-protection (empty allowlist)", () => {
    assert.deepEqual(listAllowedPairs("stable-protection"), []);
  });

  it("returns null for hooks with no restriction", () => {
    assert.equal(listAllowedPairs("dynamic-fee"), null);
    assert.equal(listAllowedPairs("rwa-gate"), null);
    assert.equal(listAllowedPairs("async-limit-order"), null);
  });
});

describe("assertHookPairAllowed", () => {
  it("throws HookPairNotAllowedError for stable-protection on any pair", () => {
    assert.throws(() => {
      assertHookPairAllowed("stable-protection", USDC, EURC);
    }, HookPairNotAllowedError);
    assert.throws(() => {
      assertHookPairAllowed("stable-protection", USDC, ETH);
    }, HookPairNotAllowedError);
    assert.throws(() => {
      assertHookPairAllowedBySymbol("stable-protection", "USDC", "EURC");
    }, HookPairNotAllowedError);
  });

  it("does not throw for hooks with no allowlist", () => {
    assert.doesNotThrow(() => {
      assertHookPairAllowed("dynamic-fee", USDC, ETH);
    });
    assert.doesNotThrow(() => {
      assertHookPairAllowed("rwa-gate", USDC, EURC);
    });
    assert.doesNotThrow(() => {
      assertHookPairAllowed("async-limit-order", USDC, EURC);
    });
    assert.doesNotThrow(() => {
      assertHookPairAllowedBySymbol("dynamic-fee", "USDC", "EURC");
    });
  });

  it("surfaces a hook-specific reason in the error message", () => {
    try {
      assertHookPairAllowed("stable-protection", USDC, EURC);
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof HookPairNotAllowedError);
      assert.match(err.message, /1:1[- ]pegged/i);
    }
  });
});

describe("resolveHookForPool", () => {
  it("returns ZERO_ADDRESS when no hook is requested", () => {
    assert.equal(resolveHookForPool(null, USDC, EURC), ZERO_ADDRESS);
    assert.equal(resolveHookForPool(undefined, USDC, EURC), ZERO_ADDRESS);
  });

  it("throws for stable-protection on any pair (empty allowlist)", () => {
    assert.throws(() => {
      resolveHookForPool("stable-protection", USDC, EURC);
    }, HookPairNotAllowedError);
    assert.throws(() => {
      resolveHookForPool("stable-protection", USDC, ETH);
    }, HookPairNotAllowedError);
  });

  it("resolves dynamic-fee for any pair (no allowlist)", () => {
    const addr = resolveHookForPool("dynamic-fee", USDC, ETH);
    assert.equal(addr.toLowerCase(), "0x9788b8495ebcec1c1d1436681b0f56c6fc0140c0");
  });

  it("resolves rwa-gate for any pair", () => {
    const addr = resolveHookForPool("rwa-gate", USDC, EURC);
    assert.equal(addr.toLowerCase(), "0xbba7cf860b47e16b9b83d8185878ec0fad0d4a80");
  });

  it("resolves async-limit-order for any pair", () => {
    const addr = resolveHookForPool("async-limit-order", USDC, EURC);
    assert.equal(addr.toLowerCase(), "0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8");
  });
});
