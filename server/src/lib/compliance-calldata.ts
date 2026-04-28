import { encodeFunctionData, getAddress } from "viem";
import { COMPLIANCE_REGISTRY, COMPLIANCE_REGISTRY_ABI } from "./compliance-registry.ts";

export interface PreparedTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: "0";
}

export class ComplianceRegistryUnavailableError extends Error {
  constructor() {
    super("ComplianceRegistry is not deployed on the active network");
    this.name = "ComplianceRegistryUnavailableError";
  }
}

function requireRegistry(): `0x${string}` {
  if (!COMPLIANCE_REGISTRY) throw new ComplianceRegistryUnavailableError();
  return COMPLIANCE_REGISTRY;
}

function checksum(addr: string): `0x${string}` {
  return getAddress(addr);
}

/** `expiry === 0` → no expiry. Future timestamps must be > now (server-checked). */
export function buildAddToWhitelist(account: string, expiry: bigint): PreparedTx {
  const to = requireRegistry();
  const data = encodeFunctionData({
    abi: COMPLIANCE_REGISTRY_ABI,
    functionName: "addToWhitelist",
    args: [checksum(account), expiry],
  });
  return { to, data, value: "0" };
}

export function buildBatchAddToWhitelist(
  accounts: readonly string[],
  expiries: readonly bigint[],
): PreparedTx {
  if (accounts.length !== expiries.length) {
    throw new Error("accounts and expiries length mismatch");
  }
  if (accounts.length === 0) throw new Error("at least one account required");
  const to = requireRegistry();
  const data = encodeFunctionData({
    abi: COMPLIANCE_REGISTRY_ABI,
    functionName: "batchAddToWhitelist",
    args: [accounts.map(checksum), [...expiries]],
  });
  return { to, data, value: "0" };
}

export function buildRemoveFromWhitelist(account: string): PreparedTx {
  const to = requireRegistry();
  const data = encodeFunctionData({
    abi: COMPLIANCE_REGISTRY_ABI,
    functionName: "removeFromWhitelist",
    args: [checksum(account)],
  });
  return { to, data, value: "0" };
}
