import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TargetNotAllowedError, assertAllowedTarget, isAllowedTarget } from "./allowed-targets.ts";
import { TOKENS } from "../tokens.ts";
import { HOOK_DEPLOYMENTS_ARC, PERMIT2, V4_POOL_MANAGER } from "../v4-contracts.ts";

void describe("agent contract-execution allowlist (B8-006)", () => {
  void it("allows the v4 stack, tokens, and Permit2 — case-insensitively", () => {
    assert.ok(isAllowedTarget(V4_POOL_MANAGER));
    assert.ok(isAllowedTarget(V4_POOL_MANAGER.toUpperCase().replace("0X", "0x")));
    assert.ok(isAllowedTarget(PERMIT2));
    for (const token of Object.values(TOKENS)) {
      assert.ok(isAllowedTarget(token.address), token.symbol);
    }
    for (const stack of Object.values(HOOK_DEPLOYMENTS_ARC)) {
      if (stack.poolSwapTest) assert.ok(isAllowedTarget(stack.poolSwapTest));
      if (stack.positionManager) assert.ok(isAllowedTarget(stack.positionManager));
    }
  });

  void it("refuses an arbitrary contract with a typed error", () => {
    const stranger = "0x000000000000000000000000000000000000dEaD";
    assert.equal(isAllowedTarget(stranger), false);
    assert.throws(() => {
      assertAllowedTarget(stranger);
    }, TargetNotAllowedError);
  });
});
