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
const CIRBTC = TOKENS.cirBTC.address;
const UNKNOWN = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

// Arc Testnet hook → pair matrix:
//  - stable-protection: USDC/EURC
//  - dynamic-fee:       USDC/cirBTC, EURC/cirBTC
//  - rwa-gate:          USDC/EURC, USDC/cirBTC
//  - alo:               USDC/cirBTC, EURC/cirBTC
describe("isHookPairAllowed — stable-protection (USDC/EURC only)", () => {
  it("accepts USDC/EURC (either order)", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, EURC), true);
    assert.equal(isHookPairAllowed("stable-protection", EURC, USDC), true);
    assert.equal(isHookPairAllowedBySymbol("stable-protection", "USDC", "EURC"), true);
  });
  it("rejects USDC/cirBTC", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, CIRBTC), false);
  });
  it("rejects unknown token addresses", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, UNKNOWN), false);
  });
});

describe("isHookPairAllowed — dynamic-fee (volatile pairs)", () => {
  it("accepts USDC/cirBTC and EURC/cirBTC", () => {
    assert.equal(isHookPairAllowed("dynamic-fee", USDC, CIRBTC), true);
    assert.equal(isHookPairAllowed("dynamic-fee", EURC, CIRBTC), true);
  });
  it("rejects USDC/EURC (stable pair)", () => {
    assert.equal(isHookPairAllowed("dynamic-fee", USDC, EURC), false);
  });
});

describe("isHookPairAllowed — rwa-gate (gated USDC/EURC + USDC/cirBTC)", () => {
  it("accepts USDC/EURC and USDC/cirBTC", () => {
    assert.equal(isHookPairAllowedBySymbol("rwa-gate", "USDC", "EURC"), true);
    assert.equal(isHookPairAllowedBySymbol("rwa-gate", "USDC", "cirBTC"), true);
  });
  it("rejects EURC/cirBTC", () => {
    assert.equal(isHookPairAllowedBySymbol("rwa-gate", "EURC", "cirBTC"), false);
  });
});

describe("isHookPairAllowed — alo (volatile pairs)", () => {
  it("accepts USDC/cirBTC and EURC/cirBTC", () => {
    assert.equal(isHookPairAllowedBySymbol("alo", "USDC", "cirBTC"), true);
    assert.equal(isHookPairAllowedBySymbol("alo", "EURC", "cirBTC"), true);
  });
  it("rejects USDC/EURC", () => {
    assert.equal(isHookPairAllowedBySymbol("alo", "USDC", "EURC"), false);
  });
});

describe("listAllowedPairs", () => {
  it("returns [['USDC','EURC']] for stable-protection", () => {
    assert.deepEqual(listAllowedPairs("stable-protection"), [["USDC", "EURC"]]);
  });
  it("returns the volatile pairs for dynamic-fee", () => {
    assert.deepEqual(listAllowedPairs("dynamic-fee"), [
      ["USDC", "cirBTC"],
      ["EURC", "cirBTC"],
    ]);
  });
});

describe("assertHookPairAllowed", () => {
  it("does not throw on an allowed pair", () => {
    assert.doesNotThrow(() => {
      assertHookPairAllowed("stable-protection", USDC, EURC);
    });
    assert.doesNotThrow(() => {
      assertHookPairAllowedBySymbol("alo", "USDC", "cirBTC");
    });
  });
  it("throws HookPairNotAllowedError for a disallowed pair", () => {
    assert.throws(() => {
      assertHookPairAllowed("stable-protection", USDC, CIRBTC);
    }, HookPairNotAllowedError);
    assert.throws(() => {
      assertHookPairAllowedBySymbol("alo", "USDC", "EURC");
    }, HookPairNotAllowedError);
  });
});

describe("resolveHookForPool", () => {
  it("returns ZERO_ADDRESS when no hook is requested", () => {
    assert.equal(resolveHookForPool(null, USDC, EURC), ZERO_ADDRESS);
    assert.equal(resolveHookForPool(undefined, USDC, CIRBTC), ZERO_ADDRESS);
  });
  // Arc hook addresses are placeholders until Phase E; any hook request
  // therefore fails fast with "not deployed". Swap to address assertions
  // once the real Arc deployments land.
  it("throws while hook addresses are unset", () => {
    assert.throws(() => resolveHookForPool("stable-protection", USDC, EURC));
    assert.throws(() => resolveHookForPool("dynamic-fee", USDC, CIRBTC));
  });
});
