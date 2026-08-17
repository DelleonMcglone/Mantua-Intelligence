import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import { creatableMarkets } from "./markets-onchain.ts";
import { MARKETS_ARC } from "../markets-contracts.ts";
import { isAllowedTarget } from "../circle/allowed-targets.ts";
import type { PlannedMarket } from "./ingest.ts";

const NOW = 1_800_000_000;

function planned(overrides: Partial<PlannedMarket> = {}): PlannedMarket {
  return {
    marketId: "0x1111111111111111111111111111111111111111111111111111111111111111",
    providerEventId: "401671789",
    league: "nfl",
    marketType: "moneyline",
    outcomeIndex: 0,
    label: "KC to beat LV",
    kickoffTimestamp: NOW + 3600,
    openingProbability: 0.62,
    ...overrides,
  };
}

void describe("markets on-chain wiring", () => {
  void it("MARKETS_ARC addresses are checksummed and distinct", () => {
    for (const addr of Object.values(MARKETS_ARC)) {
      assert.equal(getAddress(addr), addr, addr);
    }
    assert.equal(new Set(Object.values(MARKETS_ARC)).size, 3);
  });

  void it("the settlement layer is on the agent allowlist (B8-006)", () => {
    assert.ok(isAllowedTarget(MARKETS_ARC.factory));
    assert.ok(isAllowedTarget(MARKETS_ARC.resolver));
    assert.ok(isAllowedTarget(MARKETS_ARC.collateral));
  });

  void it("creatableMarkets drops games at or past kickoff — the factory would revert StartInPast", () => {
    const list = [
      planned(),
      planned({ marketId: "0x22…", kickoffTimestamp: NOW }),
      planned({ marketId: "0x33…", kickoffTimestamp: NOW - 60 }),
    ] as PlannedMarket[];
    const out = creatableMarkets(list, NOW);
    assert.equal(out.length, 1);
    assert.equal(out[0].kickoffTimestamp, NOW + 3600);
  });
});
