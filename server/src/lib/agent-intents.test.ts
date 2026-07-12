import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findMaxSafeClipRaw } from "./agent-intents.ts";

/**
 * AMM-shaped impact model for the search tests: impact grows linearly with
 * trade size relative to pool depth (a good local approximation of a
 * constant-product pool), plus a constant floor (fee + spot mismatch).
 */
function linearImpact(opts: { floorPct: number; pctPerUnit: number }) {
  return (raw: bigint): Promise<number> =>
    Promise.resolve(opts.floorPct + Number(raw) * opts.pctPerUnit);
}

void describe("findMaxSafeClipRaw", () => {
  void it("returns the full amount when it is already under the limit", async () => {
    const clip = await findMaxSafeClipRaw({
      amountInRaw: 1_000_000n,
      maxImpactPct: 9,
      impactForAmountRaw: linearImpact({ floorPct: 0.3, pctPerUnit: 0.000001 }), // 1.3% at full size
    });
    assert.equal(clip, 1_000_000n);
  });

  void it("finds a clip under the limit when the full amount breaches", async () => {
    // 0.3% floor + 0.00002%/unit → 20.3% at 1,000,000; limit 9% → safe ≈ 435,000.
    const impact = linearImpact({ floorPct: 0.3, pctPerUnit: 0.00002 });
    const clip = await findMaxSafeClipRaw({
      amountInRaw: 1_000_000n,
      maxImpactPct: 9,
      impactForAmountRaw: impact,
    });
    assert.ok(clip !== null);
    assert.ok(clip < 1_000_000n, "clip must be a partial fill");
    assert.ok((await impact(clip)) <= 9, "clip must respect the limit");
    // Must not be needlessly small: the true boundary is 435,000 and the
    // search resolution is amountIn/2^10 ≈ 977, so demand near-boundary.
    assert.ok(clip > 420_000n, `clip ${String(clip)} is far below the safe boundary`);
  });

  void it("returns null when even a tiny probe breaches (stale pool)", async () => {
    const clip = await findMaxSafeClipRaw({
      amountInRaw: 1_000_000n,
      maxImpactPct: 9,
      // Spot itself is 36% off — size-independent, like the mispriced pool.
      impactForAmountRaw: () => Promise.resolve(36),
      iterations: 8,
    });
    assert.equal(clip, null);
  });

  void it("returns null for a non-positive amount", async () => {
    const clip = await findMaxSafeClipRaw({
      amountInRaw: 0n,
      maxImpactPct: 9,
      impactForAmountRaw: () => Promise.resolve(0),
    });
    assert.equal(clip, null);
  });

  void it("treats non-finite impact readings as unsafe", async () => {
    const clip = await findMaxSafeClipRaw({
      amountInRaw: 1_000_000n,
      maxImpactPct: 9,
      impactForAmountRaw: () => Promise.resolve(Number.NaN),
    });
    assert.equal(clip, null);
  });
});
