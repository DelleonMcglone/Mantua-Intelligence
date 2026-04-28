/**
 * Phase 5 P5-011 — RWAGate ComplianceRegistry.
 *
 * Deployed companion contract to RWAGate hook. Owns the KYC allowlist
 * the hook reads via `isCompliant(address)`. All state-changing
 * functions are gated by `onlyOperator` on-chain — the server prepares
 * calldata; the operator wallet signs and submits.
 *
 * Source: contracts/hooks/rwa-gate/src/lib/ComplianceRegistry.sol.
 * Deployment record: contracts/hooks/rwa-gate/README.md.
 */

import { IS_MAINNET } from "./constants.ts";

const COMPLIANCE_REGISTRY_MAINNET: `0x${string}` | null = null;
const COMPLIANCE_REGISTRY_SEPOLIA: `0x${string}` =
  "0x11B261AE5AF867baA69506dfE6d62eeE9DB5D796" as const;

export const COMPLIANCE_REGISTRY: `0x${string}` | null = IS_MAINNET
  ? COMPLIANCE_REGISTRY_MAINNET
  : COMPLIANCE_REGISTRY_SEPOLIA;

export const COMPLIANCE_REGISTRY_ABI = [
  {
    type: "function",
    name: "addToWhitelist",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address", name: "account" },
      { type: "uint256", name: "_expiry" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "batchAddToWhitelist",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address[]", name: "accounts" },
      { type: "uint256[]", name: "expiries" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "removeFromWhitelist",
    stateMutability: "nonpayable",
    inputs: [{ type: "address", name: "account" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isCompliant",
    stateMutability: "view",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "operator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;
