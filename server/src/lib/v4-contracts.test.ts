/**
 * P9-001 — `effectivePoolFee` + `isFeeTier` unit tests. The
 * dynamic-fee override has been the source of two production
 * incidents (hook-rejecting initialize, slot0 lookup miss). These
 * tests freeze the contract.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DYNAMIC_FEE_FLAG,
  HOOK_REQUIRES_DYNAMIC_FEE,
  effectivePoolFee,
  isFeeTier,
} from "./v4-contracts.ts";

describe("isFeeTier", () => {
  it("accepts the four canonical v4 tiers", () => {
    assert.equal(isFeeTier(100), true);
    assert.equal(isFeeTier(500), true);
    assert.equal(isFeeTier(3000), true);
    assert.equal(isFeeTier(10000), true);
  });

  it("rejects anything outside the four tiers", () => {
    assert.equal(isFeeTier(0), false);
    assert.equal(isFeeTier(1), false);
    assert.equal(isFeeTier(99), false);
    assert.equal(isFeeTier(101), false);
    assert.equal(isFeeTier(2500), false);
    assert.equal(isFeeTier(DYNAMIC_FEE_FLAG), false);
  });
});

describe("HOOK_REQUIRES_DYNAMIC_FEE", () => {
  it("stable-protection requires dynamic fee", () => {
    assert.equal(HOOK_REQUIRES_DYNAMIC_FEE["stable-protection"], true);
  });

  it("dynamic-fee requires dynamic fee", () => {
    assert.equal(HOOK_REQUIRES_DYNAMIC_FEE["dynamic-fee"], true);
  });

  it("rwa-gate does not require dynamic fee", () => {
    assert.equal(HOOK_REQUIRES_DYNAMIC_FEE["rwa-gate"], false);
  });

  it("async-limit-order does not require dynamic fee", () => {
    assert.equal(HOOK_REQUIRES_DYNAMIC_FEE["async-limit-order"], false);
  });
});

describe("effectivePoolFee", () => {
  it("null hook → static fee passes through unchanged", () => {
    assert.equal(effectivePoolFee(null, 100), 100);
    assert.equal(effectivePoolFee(null, 500), 500);
    assert.equal(effectivePoolFee(undefined, 3000), 3000);
  });

  it("stable-protection always yields DYNAMIC_FEE_FLAG", () => {
    assert.equal(effectivePoolFee("stable-protection", 100), DYNAMIC_FEE_FLAG);
    assert.equal(effectivePoolFee("stable-protection", 500), DYNAMIC_FEE_FLAG);
    assert.equal(effectivePoolFee("stable-protection", 3000), DYNAMIC_FEE_FLAG);
    assert.equal(effectivePoolFee("stable-protection", 10000), DYNAMIC_FEE_FLAG);
  });

  it("dynamic-fee always yields DYNAMIC_FEE_FLAG", () => {
    assert.equal(effectivePoolFee("dynamic-fee", 100), DYNAMIC_FEE_FLAG);
    assert.equal(effectivePoolFee("dynamic-fee", 500), DYNAMIC_FEE_FLAG);
  });

  it("rwa-gate / async-limit-order pass static fee through", () => {
    assert.equal(effectivePoolFee("rwa-gate", 100), 100);
    assert.equal(effectivePoolFee("rwa-gate", 3000), 3000);
    assert.equal(effectivePoolFee("async-limit-order", 500), 500);
    assert.equal(effectivePoolFee("async-limit-order", 10000), 10000);
  });

  it("DYNAMIC_FEE_FLAG sanity (matches v4-core LPFeeLibrary)", () => {
    // 0x800000 = 2^23. v4-core sets the high bit of uint24 fee to flag
    // dynamic. If this constant ever drifts, every Stable Protection
    // and Dynamic Fee pool would silently mismatch on-chain.
    assert.equal(DYNAMIC_FEE_FLAG, 0x800000);
    assert.equal(DYNAMIC_FEE_FLAG, 8388608);
  });
});
