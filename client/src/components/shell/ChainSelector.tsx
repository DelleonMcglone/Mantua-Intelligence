import { NETWORK_OPTIONS } from "@/lib/chains.ts";
import { NetworkLogo } from "./network-icons.tsx";

/**
 * Static network chip. Mantua runs on Arc Testnet only, so this is a
 * non-interactive badge (no dropdown, no `wallet.switchChain`) showing
 * the active network's brand logo + name. If a second chain is ever
 * reintroduced, restore the dropdown from git history (pre-Arc-only).
 */
export function ChainSelector() {
  const active = NETWORK_OPTIONS[0];

  return (
    <span
      aria-label={`Network: ${active.displayName}`}
      className="px-2.5 py-1 rounded-full border border-border bg-bg-elev text-text-dim text-[12px] inline-flex items-center gap-1.5"
    >
      <NetworkLogo network={active.key} size={16} />
      {active.shortName}
    </span>
  );
}
