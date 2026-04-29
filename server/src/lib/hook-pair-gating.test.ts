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

describe("resolveHookForPool", () => {
  it("returns ZERO_ADDRESS when no hook is requested", () => {
    assert.equal(resolveHookForPool(null, USDC, EURC), ZERO_ADDRESS);
    assert.equal(resolveHookForPool(undefined, USDC, EURC), ZERO_ADDRESS);
  });

  it("resolves stable-protection for the USDC/EURC allowed pair", () => {
    const addr = resolveHookForPool("stable-protection", USDC, EURC);
    assert.equal(addr.toLowerCase(), "0xe5e6a9e09ad1e536788f0c142ad5bc69e8b020c0");
  });

  it("rejects stable-protection on a volatile pair", () => {
    assert.throws(
      () => resolveHookForPool("stable-protection", USDC, ETH),
      (err: unknown) => err instanceof HookPairNotAllowedError,
    );
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
