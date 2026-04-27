/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
/**
 * Permit2 + v4 PositionManager.multicall plumbing for the add-liquidity
 * flow. The server returns the EIP-712 typed data and the raw
 * PermitBatch struct (with bigint fields stringified for JSON
 * transit); this module deserializes them, gets the user's signature,
 * and stitches the multicall calldata.
 *
 * `any` on viem boundaries is the deliberate erasure documented in
 * erc20-allowance.ts.
 */
import { encodeFunctionData } from "viem";

const POSITION_MANAGER = "0x7c5f5a4bbd8fd63184577525326123b519429bdc" as const;

interface PermitDetailsWire {
  token: `0x${string}`;
  amount: string;
  expiration: number;
  nonce: number;
}

export interface PermitBatchWire {
  details: PermitDetailsWire[];
  spender: `0x${string}`;
  sigDeadline: string;
}

interface TypedDataWire {
  domain: {
    name: "Permit2";
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: {
    PermitDetails: { name: string; type: string }[];
    PermitBatch: { name: string; type: string }[];
  };
  primaryType: "PermitBatch";
  message: PermitBatchWire;
}

export interface Permit2Bundle {
  permit2Address: `0x${string}`;
  typedData: TypedDataWire;
  permitBatch: PermitBatchWire;
}

const PERMIT_BATCH_TUPLE = {
  type: "tuple",
  components: [
    {
      type: "tuple[]",
      components: [
        { type: "address", name: "token" },
        { type: "uint160", name: "amount" },
        { type: "uint48", name: "expiration" },
        { type: "uint48", name: "nonce" },
      ],
      name: "details",
    },
    { type: "address", name: "spender" },
    { type: "uint256", name: "sigDeadline" },
  ],
  name: "_permitBatch",
} as const;

const PM_PERMIT_BATCH_ABI = [
  {
    type: "function",
    name: "permitBatch",
    stateMutability: "payable",
    inputs: [
      { type: "address", name: "owner" },
      PERMIT_BATCH_TUPLE,
      { type: "bytes", name: "signature" },
    ],
    outputs: [{ type: "bytes", name: "err" }],
  },
] as const;

const PM_MULTICALL_ABI = [
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ type: "bytes[]", name: "data" }],
    outputs: [{ type: "bytes[]", name: "results" }],
  },
] as const;

function deserializePermitBatch(p: PermitBatchWire) {
  return {
    details: p.details.map((d) => ({
      token: d.token,
      amount: BigInt(d.amount),
      expiration: d.expiration,
      nonce: d.nonce,
    })),
    spender: p.spender,
    sigDeadline: BigInt(p.sigDeadline),
  };
}

/**
 * Convert the wire typed data into the shape viem's signTypedData
 * accepts — bigint amounts and sigDeadline. Returns the args object
 * minus `account` (caller adds that).
 */
export function buildSignTypedDataArgs(t: TypedDataWire) {
  return {
    domain: t.domain,
    types: t.types as any,
    primaryType: t.primaryType,
    message: deserializePermitBatch(t.message) as any,
  };
}

/**
 * Wrap a permitBatch + an inner modifyLiquidities calldata in a
 * PositionManager.multicall. Multicall is delegatecall, so msg.sender
 * stays the user (which becomes Permit2's `owner`) and msg.value flows
 * through to the inner modifyLiquidities for the native side.
 */
export function wrapInMulticall(
  owner: `0x${string}`,
  permitBatchWire: PermitBatchWire,
  signature: `0x${string}`,
  modifyLiquiditiesCalldata: `0x${string}`,
): { to: `0x${string}`; data: `0x${string}` } {
  const permitBatch = deserializePermitBatch(permitBatchWire);
  const permitBatchCalldata = encodeFunctionData({
    abi: PM_PERMIT_BATCH_ABI,
    functionName: "permitBatch",
    args: [owner, permitBatch, signature],
  });
  const data = encodeFunctionData({
    abi: PM_MULTICALL_ABI,
    functionName: "multicall",
    args: [[permitBatchCalldata, modifyLiquiditiesCalldata]],
  });
  return { to: POSITION_MANAGER, data };
}
