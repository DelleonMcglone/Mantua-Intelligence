import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, getAddress } from "viem";
import {
  buildAddToWhitelist,
  buildBatchAddToWhitelist,
  buildRemoveFromWhitelist,
} from "./compliance-calldata.ts";
import {
  COMPLIANCE_REGISTRY,
  COMPLIANCE_REGISTRY_ABI,
} from "./compliance-registry.ts";

const ALICE = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const BOB = "0xbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbB";

const ALICE_CHECKSUM = getAddress(ALICE);
const BOB_CHECKSUM = getAddress(BOB);

describe("buildAddToWhitelist", () => {
  it("encodes addToWhitelist(account, 0) for indefinite entries", () => {
    const tx = buildAddToWhitelist(ALICE, 0n);
    assert.equal(tx.to, COMPLIANCE_REGISTRY);
    assert.equal(tx.value, "0");
    const decoded = decodeFunctionData({
      abi: COMPLIANCE_REGISTRY_ABI,
      data: tx.data,
    });
    assert.equal(decoded.functionName, "addToWhitelist");
    assert.deepEqual(decoded.args, [ALICE_CHECKSUM, 0n]);
  });

  it("encodes addToWhitelist with a future expiry", () => {
    const future = 9_999_999_999n;
    const tx = buildAddToWhitelist(ALICE, future);
    const decoded = decodeFunctionData({
      abi: COMPLIANCE_REGISTRY_ABI,
      data: tx.data,
    });
    assert.deepEqual(decoded.args, [ALICE_CHECKSUM, future]);
  });
});

describe("buildBatchAddToWhitelist", () => {
  it("encodes batch with mixed expiries", () => {
    const tx = buildBatchAddToWhitelist([ALICE, BOB], [0n, 9_999_999_999n]);
    const decoded = decodeFunctionData({
      abi: COMPLIANCE_REGISTRY_ABI,
      data: tx.data,
    });
    assert.equal(decoded.functionName, "batchAddToWhitelist");
    assert.deepEqual(decoded.args, [
      [ALICE_CHECKSUM, BOB_CHECKSUM],
      [0n, 9_999_999_999n],
    ]);
  });

  it("rejects mismatched lengths", () => {
    assert.throws(() => buildBatchAddToWhitelist([ALICE], [0n, 1n]));
  });

  it("rejects empty input", () => {
    assert.throws(() => buildBatchAddToWhitelist([], []));
  });
});

describe("buildRemoveFromWhitelist", () => {
  it("encodes removeFromWhitelist(account)", () => {
    const tx = buildRemoveFromWhitelist(ALICE);
    const decoded = decodeFunctionData({
      abi: COMPLIANCE_REGISTRY_ABI,
      data: tx.data,
    });
    assert.equal(decoded.functionName, "removeFromWhitelist");
    assert.deepEqual(decoded.args, [ALICE_CHECKSUM]);
  });
});
