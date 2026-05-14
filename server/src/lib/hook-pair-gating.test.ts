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

// MVP gating: Stable Protection is the only hook and is restricted to
// the USDC/EURC pair. Every other pair (with or without a hook arg)
// must resolve to a no-hook pool.
describe("isHookPairAllowed — stable-protection (USDC/EURC only)", () => {
  it("accepts USDC/EURC (either order)", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, EURC), true);
    assert.equal(isHookPairAllowed("stable-protection", EURC, USDC), true);
    assert.equal(isHookPairAllowedBySymbol("stable-protection", "USDC", "EURC"), true);
    assert.equal(isHookPairAllowedBySymbol("stable-protection", "EURC", "USDC"), true);
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
    assert.equal(isHookPairAllowed("dynamic-fee", USDC, EURC), true);
    assert.equal(isHookPairAllowed("dynamic-fee", UNKNOWN, UNKNOWN), true);
    assert.equal(isHookPairAllowedBySymbol("dynamic-fee", "USDC", "EURC"), true);
  });
});

describe("listAllowedPairs", () => {
  it("returns [['USDC','EURC']] for stable-protection", () => {
    assert.deepEqual(listAllowedPairs("stable-protection"), [["USDC", "EURC"]]);
  });

  it("returns null for dynamic-fee (no restriction)", () => {
    assert.equal(listAllowedPairs("dynamic-fee"), null);
  });
});

describe("assertHookPairAllowed", () => {
  it("does not throw on USDC/EURC", () => {
    assert.doesNotThrow(() => {
      assertHookPairAllowed("stable-protection", USDC, EURC);
    });
    assert.doesNotThrow(() => {
      assertHookPairAllowedBySymbol("stable-protection", "USDC", "EURC");
    });
  });

  it("throws HookPairNotAllowedError for stable-protection on other pairs", () => {
    assert.throws(() => {
      assertHookPairAllowed("stable-protection", USDC, ETH);
    }, HookPairNotAllowedError);
    assert.throws(() => {
      assertHookPairAllowedBySymbol("stable-protection", "USDC", "cbBTC");
    }, HookPairNotAllowedError);
  });

  it("does not throw for dynamic-fee on any pair", () => {
    assert.doesNotThrow(() => {
      assertHookPairAllowed("dynamic-fee", USDC, ETH);
    });
    assert.doesNotThrow(() => {
      assertHookPairAllowed("dynamic-fee", USDC, EURC);
    });
    assert.doesNotThrow(() => {
      assertHookPairAllowedBySymbol("dynamic-fee", "ETH", "cbBTC");
    });
  });

  it("surfaces a USDC/EURC-specific reason in the error message", () => {
    try {
      assertHookPairAllowed("stable-protection", USDC, ETH);
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof HookPairNotAllowedError);
      assert.match(err.message, /USDC\/EURC/);
    }
  });
});

describe("resolveHookForPool", () => {
  it("returns ZERO_ADDRESS when no hook is requested", () => {
    assert.equal(resolveHookForPool(null, USDC, EURC), ZERO_ADDRESS);
    assert.equal(resolveHookForPool(undefined, USDC, EURC), ZERO_ADDRESS);
    assert.equal(resolveHookForPool(null, USDC, ETH), ZERO_ADDRESS);
  });

  it("resolves stable-protection on USDC/EURC", () => {
    const addr = resolveHookForPool("stable-protection", USDC, EURC);
    assert.equal(addr.toLowerCase(), "0xe5e6a9e09ad1e536788f0c142ad5bc69e8b020c0");
  });

  it("throws for stable-protection on non-USDC/EURC pairs", () => {
    assert.throws(() => {
      resolveHookForPool("stable-protection", USDC, ETH);
    }, HookPairNotAllowedError);
  });

  it("resolves dynamic-fee for any pair (no allowlist)", () => {
    const addr = resolveHookForPool("dynamic-fee", USDC, ETH);
    assert.equal(addr.toLowerCase(), "0x9788b8495ebcec1c1d1436681b0f56c6fc0140c0");
  });
});
