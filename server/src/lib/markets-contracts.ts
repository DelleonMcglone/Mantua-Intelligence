import { parseAbi } from "viem";

/**
 * The deployed sports-market settlement layer on Arc Testnet (B4 wiring,
 * broadcast 2026-08-17, both contracts verified on ArcScan).
 *
 * Deploy order was Resolver → MarketFactory → one-shot `setFactory`, so the
 * factory's immutable `resolver` is the Resolver CONTRACT — the fixed
 * authority address every Market burns in — while the keys behind it
 * (signer, operator) rotate on the Resolver without redeploying markets.
 *
 * On-chain wiring probed post-deploy: `resolver.factory()` ==
 * `MARKETS_ARC.factory`, `factory.resolver()` == `MARKETS_ARC.resolver`,
 * `factory.collateral()` == canonical Arc USDC.
 */
export const MARKETS_ARC = {
  /** MarketFactory — tx 0x64c1ccbb…5c51e70b */
  factory: "0x0cd79B383c3f10F786bF9B942F791283dFB4d6e6",
  /** Resolver — tx 0x17f78394…cc0d7470 */
  resolver: "0x76578c4EA626bEe114e5B72939e7927eF5f1CAbF",
  /** Canonical Arc USDC (6dp ERC-20 interface), the markets' collateral. */
  collateral: "0x3600000000000000000000000000000000000000",
} as const;

export const MARKET_FACTORY_ABI = parseAbi([
  "function createMarketIfAbsent(bytes32 marketId, uint64 startsAt, string label) returns (address market, bool created)",
  "function marketOf(bytes32 marketId) view returns (address)",
]);

export const RESOLVER_CONTRACT_ABI = parseAbi([
  "function freeze(bytes32 marketId)",
  "function resolve(bytes32 marketId, uint8 outcome)",
  "function voidMarket(bytes32 marketId)",
]);
