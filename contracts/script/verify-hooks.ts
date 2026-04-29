/**
 * P5-001 — Hook deployment verification.
 *
 * For each hook in the suite, fetch the on-chain bytecode at its
 * documented address (per the hook repo's broadcast/ record), record
 * a keccak256 hash for change-detection, and decode the permission
 * flags encoded in the lower 14 bits of the hook's CREATE2 address
 * (per Uniswap v4 Hooks.sol).
 *
 * Run:  tsx contracts/script/verify-hooks.ts [--write]
 *
 * --write appends/overwrites docs/security/hook-deployments.md with
 * a markdown report. Without --write, output goes to stdout only.
 */

import { keccak256, type Hex } from "viem";
import { writeFileSync } from "node:fs";

interface HookConfig {
  name: string;
  repo: string;
  pinnedCommit: string;
  address: `0x${string}`;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  expectedPermissions?: string[];
}

const HOOKS: HookConfig[] = [
  {
    name: "StableProtectionHook",
    repo: "DelleonMcglone/stableprotection-hook",
    pinnedCommit: "1282b899b6f68d27e28d65194dc75661f23476af",
    address: "0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0",
    chainId: 84532,
    chainName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    expectedPermissions: ["BEFORE_INITIALIZE", "BEFORE_SWAP", "AFTER_SWAP"],
  },
  {
    name: "DynamicFee",
    repo: "DelleonMcglone/dynamic-fee",
    pinnedCommit: "62710d6d9b403557b073a702b5546bc10e75c0c6",
    address: "0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0",
    chainId: 84532,
    chainName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    expectedPermissions: ["BEFORE_SWAP", "AFTER_SWAP"],
  },
  {
    name: "RWAGate",
    repo: "DelleonMcglone/RWAgate",
    pinnedCommit: "bb41ada54c9c9fb5a2bea296728321f68cf2dcc1",
    address: "0xbba7cf860b47e16b9b83d8185878ec0fad0d4a80",
    chainId: 84532,
    chainName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    expectedPermissions: ["BEFORE_ADD_LIQUIDITY", "BEFORE_REMOVE_LIQUIDITY", "BEFORE_SWAP"],
  },
  {
    name: "AsyncLimitOrder",
    repo: "DelleonMcglone/limit-orders",
    pinnedCommit: "89d905f1d39abbc3795015fc4adfb8140560194b",
    address: "0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8",
    chainId: 84532,
    chainName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    expectedPermissions: [
      "AFTER_INITIALIZE",
      "BEFORE_SWAP",
      "AFTER_SWAP",
      "BEFORE_SWAP_RETURNS_DELTA",
    ],
  },
];

/** Uniswap v4 Hooks.sol permission flags (lower 14 bits of hook address). */
const HOOK_FLAGS = {
  BEFORE_INITIALIZE: 1 << 13,
  AFTER_INITIALIZE: 1 << 12,
  BEFORE_ADD_LIQUIDITY: 1 << 11,
  AFTER_ADD_LIQUIDITY: 1 << 10,
  BEFORE_REMOVE_LIQUIDITY: 1 << 9,
  AFTER_REMOVE_LIQUIDITY: 1 << 8,
  BEFORE_SWAP: 1 << 7,
  AFTER_SWAP: 1 << 6,
  BEFORE_DONATE: 1 << 5,
  AFTER_DONATE: 1 << 4,
  BEFORE_SWAP_RETURNS_DELTA: 1 << 3,
  AFTER_SWAP_RETURNS_DELTA: 1 << 2,
  AFTER_ADD_LIQUIDITY_RETURNS_DELTA: 1 << 1,
  AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA: 1 << 0,
} as const;

function decodePermissions(address: string): string[] {
  const lower14 = parseInt(address.slice(-4), 16) & 0x3fff;
  return Object.entries(HOOK_FLAGS)
    .filter(([, flag]) => (lower14 & flag) !== 0)
    .map(([name]) => name);
}

interface VerifyResult {
  hook: HookConfig;
  deployed: boolean;
  bytecodeLength: number;
  bytecodeHash: string | null;
  permissions: string[];
  permissionsMatch: boolean | null;
  error?: string;
}

async function verify(hook: HookConfig): Promise<VerifyResult> {
  const permissions = decodePermissions(hook.address);
  const permissionsMatch = hook.expectedPermissions
    ? hook.expectedPermissions.every((p) => permissions.includes(p)) &&
      permissions.length === hook.expectedPermissions.length
    : null;

  try {
    const res = await fetch(hook.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getCode",
        params: [hook.address, "latest"],
      }),
    });
    if (!res.ok) {
      return {
        hook,
        deployed: false,
        bytecodeLength: 0,
        bytecodeHash: null,
        permissions,
        permissionsMatch,
        error: `rpc http ${res.status}`,
      };
    }
    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (json.error) {
      return {
        hook,
        deployed: false,
        bytecodeLength: 0,
        bytecodeHash: null,
        permissions,
        permissionsMatch,
        error: json.error.message ?? "rpc error",
      };
    }
    const code = json.result ?? "0x";
    const deployed = code !== "0x" && code.length > 2;
    return {
      hook,
      deployed,
      bytecodeLength: deployed ? (code.length - 2) / 2 : 0,
      bytecodeHash: deployed ? keccak256(code as Hex) : null,
      permissions,
      permissionsMatch,
    };
  } catch (err) {
    return {
      hook,
      deployed: false,
      bytecodeLength: 0,
      bytecodeHash: null,
      permissions,
      permissionsMatch,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function renderMarkdown(results: VerifyResult[]): string {
  const lines: string[] = [];
  lines.push("# Hook deployment verification (P5-001)");
  lines.push("");
  lines.push(`Last run: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("| Hook | Chain | Address | Deployed | Bytecode size | Bytecode hash | Permissions | Match |");
  lines.push("|---|---|---|---|---:|---|---|---|");
  for (const r of results) {
    const chain = `${r.hook.chainName} (${String(r.hook.chainId)})`;
    const addr = `\`${r.hook.address}\``;
    const dep = r.deployed ? "✅" : "❌";
    const size = r.deployed ? `${String(r.bytecodeLength)} B` : "—";
    const hash = r.bytecodeHash ? `\`${r.bytecodeHash.slice(0, 18)}…\`` : r.error ?? "—";
    const perms = r.permissions.length > 0 ? r.permissions.join(", ") : "—";
    const match =
      r.permissionsMatch === null ? "n/a" : r.permissionsMatch ? "✅" : "❌";
    lines.push(`| \`${r.hook.name}\` | ${chain} | ${addr} | ${dep} | ${size} | ${hash} | ${perms} | ${match} |`);
  }
  lines.push("");
  lines.push("## Pinned source commits");
  lines.push("");
  for (const r of results) {
    lines.push(
      `- \`${r.hook.name}\` — [${r.hook.repo}@${r.hook.pinnedCommit.slice(0, 7)}](https://github.com/${r.hook.repo}/commit/${r.hook.pinnedCommit})`,
    );
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "All four hooks are testnet deployments. None are on Base mainnet (8453). Re-deployment to mainnet + a fresh run of this verification is a launch-gating step (separate Phase 5 ticket).",
  );
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const results = await Promise.all(HOOKS.map((h) => verify(h)));
  const md = renderMarkdown(results);
  console.log(md);
  if (process.argv.includes("--write")) {
    writeFileSync("docs/security/hook-deployments.md", md);
    console.log("Wrote docs/security/hook-deployments.md");
  }
  const failed = results.filter((r) => !r.deployed || r.permissionsMatch === false);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

void main();
