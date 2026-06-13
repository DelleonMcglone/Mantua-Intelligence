/**
 * USDC decimal handling for Arc.
 *
 * Arc's native gas token (USDC) uses 18 decimals, while the USDC ERC-20
 * interface uses 6 decimals. These MUST never be mixed: gas/fee math uses
 * the 18-decimal native units; all balances and transfers go through the
 * 6-decimal ERC-20 interface. This module is the single place that knows
 * the gap between the two representations.
 */
import { formatUnits, parseUnits } from "viem";

/** ERC-20 USDC interface decimals (balances, transfers, escrow amounts). */
export const ERC20_DECIMALS = 6 as const;

/** Arc native gas-token (USDC) decimals (gas/fee math only). */
export const NATIVE_GAS_DECIMALS = 18 as const;

/** Power-of-ten gap between native (18) and ERC-20 (6) representations. */
export const NATIVE_ERC20_GAP = 10n ** BigInt(NATIVE_GAS_DECIMALS - ERC20_DECIMALS);

/** Human string → 6-decimal ERC-20 base units (e.g. "1.5" → 1_500_000n). */
export function toErc20Units(human: string): bigint {
  return parseUnits(human, ERC20_DECIMALS);
}

/** 6-decimal ERC-20 base units → human string (e.g. 1_500_000n → "1.5"). */
export function fromErc20Units(units: bigint): string {
  return formatUnits(units, ERC20_DECIMALS);
}

/** Human string → 18-decimal native gas units. */
export function toNativeGasUnits(human: string): bigint {
  return parseUnits(human, NATIVE_GAS_DECIMALS);
}

/** 18-decimal native gas units → human string. */
export function fromNativeGasUnits(units: bigint): string {
  return formatUnits(units, NATIVE_GAS_DECIMALS);
}

/**
 * Convert a 6-decimal ERC-20 USDC amount to its 18-decimal native-gas
 * representation (multiply by 10^12). Use only when reasoning about the
 * same USDC quantity across both interfaces.
 */
export function erc20ToNative(units6: bigint): bigint {
  return units6 * NATIVE_ERC20_GAP;
}

/**
 * Convert an 18-decimal native-gas USDC amount down to 6-decimal ERC-20
 * units (integer division by 10^12, truncating sub-6dp dust).
 */
export function nativeToErc20(units18: bigint): bigint {
  return units18 / NATIVE_ERC20_GAP;
}
