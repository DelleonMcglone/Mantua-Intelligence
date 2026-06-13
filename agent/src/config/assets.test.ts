/**
 * Tests for the asset allowlist — accept path (USDC/EURC/cirBTC by symbol
 * and address) and reject path (anything else throws a clear error).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Asset, createAssetAllowlist } from "./assets.ts";

const FIXTURE: Asset[] = [
  { symbol: "USDC", address: "0x3600000000000000000000000000000000000000", decimals: 6 },
  { symbol: "EURC", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6 },
  { symbol: "cirBTC", address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", decimals: 8 },
];

test("resolves allowlisted assets by symbol (case-insensitive)", () => {
  const a = createAssetAllowlist(FIXTURE);
  assert.equal(a.requireAllowed("USDC").decimals, 6);
  assert.equal(a.requireAllowed("eurc").symbol, "EURC");
  assert.equal(a.requireAllowed("cirBTC").decimals, 8);
});

test("resolves allowlisted assets by address (normalized lowercase)", () => {
  const a = createAssetAllowlist(FIXTURE);
  const usdc = a.requireAllowed("0x3600000000000000000000000000000000000000");
  assert.equal(usdc.symbol, "USDC");
  assert.ok(a.isAllowedAddress("0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"));
});

test("rejects a non-allowlisted symbol with a clear error", () => {
  const a = createAssetAllowlist(FIXTURE);
  assert.throws(() => a.requireAllowed("DAI"), /not on the allowlist/);
  assert.throws(() => a.requireAllowed("WETH"), /USDC, EURC, cirBTC/);
});

test("rejects a non-allowlisted address", () => {
  const a = createAssetAllowlist(FIXTURE);
  assert.equal(a.isAllowedAddress("0x000000000000000000000000000000000000dEaD"), false);
  assert.throws(() => a.requireAllowed("0x000000000000000000000000000000000000dEaD"), /allowlist/);
});

test("fails fast on a malformed config address", () => {
  assert.throws(
    () => createAssetAllowlist([{ symbol: "USDC", address: "0xnope", decimals: 6 }]),
    /Invalid address/,
  );
});
