import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HookPairNotAllowedError,
  assertHookPairAllowed,
  isHookPairAllowed,
  listAllowedPairs,
  resolveHookForPool,
} from "./hook-pair-gating.ts";
import { TOKENS, ZERO_ADDRESS } from "./tokens.ts";

const USDC = TOKENS.USDC.address;
const EURC = TOKENS.EURC.address;
const ETH = TOKENS.ETH.address;
const UNKNOWN = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

// POC build (PR #74) opened the allowlist — every hook accepts every
// pair at this server layer. The on-chain hook contract remains the
// source of truth; if it doesn't like a pair, its `beforeInitialize`
// reverts and the existing wallet error path surfaces it. These tests
// guard the "we no longer pre-filter" contract.
describe("isHookPairAllowed — stable-protection (open allowlist)", () => {
  it("allows USDC/EURC", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, EURC), true);
  });

  it("allows USDC/ETH (formerly disallowed; now hook decides on-chain)", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, ETH), true);
  });

  it("allows unknown token addresses (no pre-filter)", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, UNKNOWN), true);
  });
});

describe("isHookPairAllowed — unrestricted hooks", () => {
  it("returns true for any pair on dynamic-fee", () => {
    assert.equal(isHookPairAllowed("dynamic-fee", USDC, ETH), true);
    assert.equal(isHookPairAllowed("dynamic-fee", UNKNOWN, UNKNOWN), true);
  });

  it("returns true for any pair on rwa-gate", () => {
    assert.equal(isHookPairAllowed("rwa-gate", USDC, ETH), true);
  });

  it("returns true for any pair on async-limit-order", () => {
    assert.equal(isHookPairAllowed("async-limit-order", USDC, ETH), true);
  });
});

describe("listAllowedPairs (open allowlist)", () => {
  it("returns null for every hook now that gating is open", () => {
    assert.equal(listAllowedPairs("stable-protection"), null);
    assert.equal(listAllowedPairs("dynamic-fee"), null);
    assert.equal(listAllowedPairs("rwa-gate"), null);
    assert.equal(listAllowedPairs("async-limit-order"), null);
  });
});

describe("assertHookPairAllowed", () => {
  it("does not throw for any pair (open allowlist)", () => {
    assert.doesNotThrow(() => assertHookPairAllowed("stable-protection", USDC, EURC));
    assert.doesNotThrow(() => assertHookPairAllowed("stable-protection", USDC, ETH));
  });

  // Sanity check that the error class export survives — nothing
  // in the runtime path emits it today, but callers still type
  // against it. If the gating ever re-tightens, these throws come
  // back; this guard makes that intentional.
  it("HookPairNotAllowedError is still exported and constructible", () => {
    const err = new HookPairNotAllowedError("stable-protection", USDC, ETH);
    assert.ok(err instanceof HookPairNotAllowedError);
    assert.equal(err.hook, "stable-protection");
  });
});

describe("resolveHookForPool", () => {
  it("returns ZERO_ADDRESS when no hook is requested", () => {
    assert.equal(resolveHookForPool(null, USDC, EURC), ZERO_ADDRESS);
    assert.equal(resolveHookForPool(undefined, USDC, EURC), ZERO_ADDRESS);
  });

  it("resolves stable-protection for the USDC/EURC allowed pair", () => {
    const addr = resolveHookForPool("stable-protection", USDC, EURC);
    assert.equal(addr.toLowerCase(), "0xe5e6a9e09ad1e536788f0c142ad5bc69e8b020c0");
  });

  it("resolves stable-protection on any pair (open allowlist)", () => {
    const addr = resolveHookForPool("stable-protection", USDC, ETH);
    assert.equal(addr.toLowerCase(), "0xe5e6a9e09ad1e536788f0c142ad5bc69e8b020c0");
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
