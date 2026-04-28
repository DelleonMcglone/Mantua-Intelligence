import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HookPairNotAllowedError,
  assertHookPairAllowed,
  isHookPairAllowed,
  listAllowedPairs,
} from "./hook-pair-gating.ts";
import { TOKENS } from "./tokens.ts";

const USDC = TOKENS.USDC.address;
const EURC = TOKENS.EURC.address;
const ETH = TOKENS.ETH.address;
const UNKNOWN = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

describe("isHookPairAllowed — stable-protection", () => {
  it("allows USDC/EURC", () => {
    assert.equal(isHookPairAllowed("stable-protection", USDC, EURC), true);
  });

  it("allows EURC/USDC (order-independent)", () => {
    assert.equal(isHookPairAllowed("stable-protection", EURC, USDC), true);
  });

  it("treats addresses case-insensitively", () => {
    assert.equal(
      isHookPairAllowed("stable-protection", USDC.toUpperCase(), EURC.toLowerCase()),
      true,
    );
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
  });

  it("returns true for any pair on rwa-gate", () => {
    assert.equal(isHookPairAllowed("rwa-gate", USDC, ETH), true);
  });

  it("returns true for any pair on async-limit-order", () => {
    assert.equal(isHookPairAllowed("async-limit-order", USDC, ETH), true);
  });
});

describe("listAllowedPairs", () => {
  it("returns the explicit allowlist for stable-protection", () => {
    const pairs = listAllowedPairs("stable-protection");
    assert.deepEqual(pairs, [["USDC", "EURC"]]);
  });

  it("returns null for unrestricted hooks", () => {
    assert.equal(listAllowedPairs("dynamic-fee"), null);
    assert.equal(listAllowedPairs("rwa-gate"), null);
    assert.equal(listAllowedPairs("async-limit-order"), null);
  });
});

describe("assertHookPairAllowed", () => {
  it("does not throw for an allowed pair", () => {
    assert.doesNotThrow(() => assertHookPairAllowed("stable-protection", USDC, EURC));
  });

  it("throws HookPairNotAllowedError for a disallowed pair", () => {
    assert.throws(
      () => assertHookPairAllowed("stable-protection", USDC, ETH),
      (err: unknown) => {
        assert.ok(err instanceof HookPairNotAllowedError);
        assert.equal(err.hook, "stable-protection");
        return true;
      },
    );
  });
});
