import { AssetIcon, type AssetSymbol } from "@/features/portfolio/asset-icons.tsx";
import type { TokenSymbol } from "@/lib/tokens.ts";

const KNOWN: AssetSymbol[] = ["ETH", "cbBTC", "USDC", "EURC"];

/**
 * Renders the matching `AssetIcon` for the given token symbol; falls
 * back to a neutral coin-with-initial badge for symbols that don't
 * have a brand icon (e.g. WETH).
 */
export function TokenIcon({ symbol, size = 20 }: { symbol: TokenSymbol; size?: number }) {
  const norm = symbol === "WETH" ? "ETH" : symbol;
  if ((KNOWN as readonly string[]).includes(norm)) {
    return <AssetIcon symbol={norm as AssetSymbol} size={size} />;
  }
  const initial = symbol.slice(0, 1).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#3b3b46" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#fff"
        fontFamily="Inter, sans-serif"
      >
        {initial}
      </text>
    </svg>
  );
}
