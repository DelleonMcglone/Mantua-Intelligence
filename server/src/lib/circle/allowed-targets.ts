/**
 * B8-006 — the agent's contract-execution allowlist.
 *
 * Every calldata execution from an agent's Circle wallet passes through
 * `executeAgentCalldata`, and that single choke point refuses any target
 * not on this list. All callers today build their own targets from server
 * constants, so this is defense in depth: a bug (or a prompt-injected
 * instruction that survives the intent layer) must not be able to aim the
 * agent's wallet at an arbitrary contract.
 *
 * The list is assembled from the registries the server already trusts:
 * the token catalog, every per-hook v4 stack, Permit2, the agentic
 * commerce registry from env, and the deployed sports-market settlement
 * layer (MARKETS_ARC). Per-market contract addresses are dynamic and join
 * via the builder as those agent flows land — extend the builder, never
 * bypass the check.
 *
 * Plain USDC transfers (createTransferTransaction) are deliberately NOT
 * gated here: sends go to user-chosen recipients under the spending cap,
 * and an EOA recipient is not a contract target.
 */

import { env } from "../../env.ts";
import { MARKETS_ARC, MARKETS_PERIPHERY_ARC } from "../markets-contracts.ts";
import { TOKENS } from "../tokens.ts";
import { HOOK_DEPLOYMENTS_ARC, PERMIT2, V4_POOL_MANAGER } from "../v4-contracts.ts";

export class TargetNotAllowedError extends Error {
  constructor(target: string) {
    super(
      `Agent contract execution refused: ${target} is not an allowlisted contract. ` +
        `Agent wallets may only call known Mantua/Uniswap/Circle contracts (B8-006).`,
    );
    this.name = "TargetNotAllowedError";
  }
}

function buildAllowlist(): Set<string> {
  const targets = new Set<string>();
  const add = (addr: string | null | undefined) => {
    if (addr && addr.startsWith("0x")) targets.add(addr.toLowerCase());
  };

  for (const token of Object.values(TOKENS)) add(token.address);

  add(V4_POOL_MANAGER);
  add(PERMIT2);
  for (const stack of Object.values(HOOK_DEPLOYMENTS_ARC)) {
    add(stack.poolManager);
    add(stack.hook);
    add(stack.poolSwapTest);
    add(stack.poolModifyLiquidityTest);
    add(stack.positionManager);
    add(stack.stateView);
    add(stack.quoter);
    add(stack.token0);
    add(stack.token1);
  }

  // ERC-8004/8183 agentic-commerce registry, when configured.
  add(env.AGENTIC_COMMERCE_ADDRESS);

  // Sports-market settlement layer (B4, deployed 2026-08-17). Individual
  // Market/outcome-token addresses are dynamic — agent flows that touch
  // them will extend this via the markets registry, still through this
  // single builder.
  add(MARKETS_ARC.factory);
  add(MARKETS_ARC.resolver);
  add(MARKETS_ARC.collateral);
  for (const addr of Object.values(MARKETS_PERIPHERY_ARC)) add(addr);

  return targets;
}

let cache: Set<string> | null = null;

export function isAllowedTarget(target: string): boolean {
  cache ??= buildAllowlist();
  return cache.has(target.toLowerCase());
}

/** Throws `TargetNotAllowedError` unless `target` is allowlisted. */
export function assertAllowedTarget(target: string): void {
  if (!isAllowedTarget(target)) throw new TargetNotAllowedError(target);
}

/** Test hook — rebuild the list after env/registry mutation. */
export function resetAllowlistForTests(): void {
  cache = null;
}
