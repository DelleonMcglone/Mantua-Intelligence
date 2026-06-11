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
  HOOK_DEPLOYMENTS_ARC,
  HOOK_REQUIRES_DYNAMIC_FEE,
  effectivePoolFee,
  getV4StackForHook,
  isFeeTier,
} from "./v4-contracts.ts";

const ZERO = "0x0000000000000000000000000000000000000000";

describe("getV4StackForHook — per-hook stack routing", () => {
  it("no-hook (zero address) → the StableProtection hero stack", () => {
    const s = getV4StackForHook(ZERO);
    assert.equal(s.poolManager, "0x15B5f2c054b9DC788250131FCD1bcfCC34080a59");
    assert.equal(s.positionManager, "0x47AD8c1C78F9b07c81d833d924BbE36388A4ab78");
  });

  it("StableProtection hook → its own (== hero) stack", () => {
    const s = getV4StackForHook(HOOK_DEPLOYMENTS_ARC["stable-protection"].hook);
    assert.equal(s.poolManager, "0x15B5f2c054b9DC788250131FCD1bcfCC34080a59");
    assert.equal(s.stateView, "0x73Bb8E68c08C528770880c10223670f7aee13824");
  });

  it("DynamicFee hook → the DynamicFee stack (own PoolManager + periphery)", () => {
    const s = getV4StackForHook(HOOK_DEPLOYMENTS_ARC["dynamic-fee"].hook);
    assert.equal(s.poolManager, "0x7eA87A5919C119DC95855A0BE227fd3241c998F0");
    assert.equal(s.positionManager, "0xDa1bfA53fA93463fB9Abd349bad381667D29b88d");
    assert.equal(s.quoter, "0x2CF521F13658FE57958D09B40Ee3420D974EE7eC");
  });

  it("ALO hook → the ALO stack, with null poolSwapTest (no router deployed)", () => {
    const s = getV4StackForHook(HOOK_DEPLOYMENTS_ARC.alo.hook);
    assert.equal(s.poolManager, "0x95b7d2f0712f997A34c7D1b4CBaE144251CE083b");
    assert.equal(s.positionManager, "0x7866e36b7576DF5167cf76770799096Ba6fcD882");
    assert.equal(s.poolSwapTest, null);
  });

  it("is case-insensitive on the hook address", () => {
    const s = getV4StackForHook(HOOK_DEPLOYMENTS_ARC["dynamic-fee"].hook.toLowerCase());
    assert.equal(s.poolManager, "0x7eA87A5919C119DC95855A0BE227fd3241c998F0");
  });

  it("rwa-gate (periphery not deployed) → throws", () => {
    assert.throws(() => getV4StackForHook(HOOK_DEPLOYMENTS_ARC["rwa-gate"].hook));
  });

  it("unrecognized hook → falls back to the hero stack", () => {
    const s = getV4StackForHook("0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead");
    assert.equal(s.poolManager, "0x15B5f2c054b9DC788250131FCD1bcfCC34080a59");
  });
});

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

  it("DYNAMIC_FEE_FLAG sanity (matches v4-core LPFeeLibrary)", () => {
    // 0x800000 = 2^23. v4-core sets the high bit of uint24 fee to flag
    // dynamic. If this constant ever drifts, every Stable Protection /
    // Dynamic Fee pool would silently mismatch on-chain.
    assert.equal(DYNAMIC_FEE_FLAG, 0x800000);
    assert.equal(DYNAMIC_FEE_FLAG, 8388608);
  });
});
