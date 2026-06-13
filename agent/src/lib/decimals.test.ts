/**
 * Tests for the USDC 18↔6 decimal handling — the critical Arc trap.
 * Asserts conversions are correct in both directions and round-trip.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ERC20_DECIMALS,
  NATIVE_ERC20_GAP,
  NATIVE_GAS_DECIMALS,
  erc20ToNative,
  fromErc20Units,
  fromNativeGasUnits,
  nativeToErc20,
  toErc20Units,
  toNativeGasUnits,
} from "./decimals.ts";

test("decimal constants match Arc's dual USDC representation", () => {
  assert.equal(ERC20_DECIMALS, 6);
  assert.equal(NATIVE_GAS_DECIMALS, 18);
  assert.equal(NATIVE_ERC20_GAP, 10n ** 12n);
});

test("ERC-20 (6dp) human ↔ base units", () => {
  assert.equal(toErc20Units("1"), 1_000_000n);
  assert.equal(toErc20Units("1.5"), 1_500_000n);
  assert.equal(toErc20Units("0.000001"), 1n);
  assert.equal(fromErc20Units(1_000_000n), "1");
  assert.equal(fromErc20Units(1_500_000n), "1.5");
});

test("native gas (18dp) human ↔ base units", () => {
  assert.equal(toNativeGasUnits("1"), 10n ** 18n);
  assert.equal(fromNativeGasUnits(10n ** 18n), "1");
});

test("erc20 ↔ native conversion is exact for the same USDC quantity", () => {
  // 1 USDC == 1_000_000 (6dp) == 1e18 (18dp)
  assert.equal(erc20ToNative(1_000_000n), 10n ** 18n);
  assert.equal(nativeToErc20(10n ** 18n), 1_000_000n);
});

test("native→erc20 round-trips and truncates sub-6dp dust", () => {
  for (const u6 of [1n, 1_000_000n, 123_456_789n]) {
    assert.equal(nativeToErc20(erc20ToNative(u6)), u6, "round trip preserves 6dp value");
  }
  // Dust below 1e12 (sub-6dp) truncates to zero in the ERC-20 view.
  assert.equal(nativeToErc20(10n ** 12n - 1n), 0n);
  assert.equal(nativeToErc20(10n ** 12n), 1n);
});
