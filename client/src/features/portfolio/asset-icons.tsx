/**
 * Token SVG icons — ported from prototype `src/shell.jsx` TOKEN_SVGS.
 * Inline so they render without extra requests; sized by `size` prop.
 * Token set matches Mantua's supported tokens on Base (see
 * `client/src/lib/tokens.ts`): ETH, cbBTC, USDC, EURC.
 */

interface IconProps {
  size?: number;
}

export function EthIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#627eea" />
      <g fill="#fff" fillRule="evenodd">
        <path fillOpacity=".6" d="M16.5 4v8.87l7.5 3.35z" />
        <path d="M16.5 4L9 16.22l7.5-3.35z" />
        <path fillOpacity=".6" d="M16.5 21.97v6.03L24 17.62z" />
        <path d="M16.5 28v-6.03L9 17.62z" />
        <path fillOpacity=".2" d="M16.5 20.57l7.5-4.35-7.5-3.35z" />
        <path fillOpacity=".6" d="M9 16.22l7.5 4.35v-7.7z" />
      </g>
    </svg>
  );
}

export function CbBtcIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#0052ff" />
      <path
        d="M21 14.3c.3-1.9-1.2-2.9-3.2-3.6l.7-2.6-1.6-.4-.7 2.5c-.4-.1-.8-.2-1.3-.3l.7-2.6-1.6-.4-.7 2.6c-.4-.1-.7-.2-1-.2L10 9l-.4 1.7s1.2.3 1.1.3c.6.2.7.6.7.9l-.8 3c0 .1.1.1.2.1l-.2-.1-1.1 4.2c-.1.2-.3.5-.8.4.1.1-1.1-.3-1.1-.3L7 20.8l2.1.5c.4.1.8.2 1.1.3l-.7 2.6 1.6.4.7-2.6 1.3.3-.7 2.6 1.6.4.7-2.6c2.8.5 4.8.3 5.7-2.2.7-2-.1-3.1-1.5-3.8 1-.3 1.8-1 2.1-2.4zm-3.7 5.1c-.5 2-3.9.9-5 .6l.9-3.5c1.1.3 4.6.8 4.1 2.9zm.5-5.1c-.5 1.8-3.3.9-4.2.6l.8-3.2c1 .2 3.9.7 3.4 2.6z"
        fill="#fff"
      />
    </svg>
  );
}

export function UsdcIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#2775ca" />
      <path
        d="M20.5 18.5c0-2.4-1.5-3.2-4.3-3.6-2-.3-2.5-.8-2.5-1.8s.7-1.5 2-1.5c1.2 0 1.9.4 2.3 1.4.1.2.3.3.5.3h1c.3 0 .5-.2.5-.5v-.1c-.3-1.4-1.5-2.5-3-2.6v-1.5c0-.3-.2-.5-.5-.6h-1c-.3 0-.5.2-.6.5V10c-2 .3-3.2 1.6-3.2 3.2 0 2.3 1.4 3.1 4.2 3.5 1.9.3 2.5.7 2.5 1.9 0 1.2-1 2-2.4 2-1.9 0-2.5-.8-2.7-1.9-.1-.3-.3-.4-.5-.4h-1.1c-.3 0-.5.2-.5.5v.1c.3 1.6 1.3 2.7 3.4 3v1.5c0 .3.2.5.5.6h1c.3 0 .5-.2.6-.5v-1.5c2-.3 3.3-1.7 3.3-3.5z"
        fill="#fff"
      />
    </svg>
  );
}

export function EurcIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#003399" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#ffcc00"
        fontFamily="Inter, sans-serif"
      >
        €
      </text>
    </svg>
  );
}

export type AssetSymbol = "ETH" | "cbBTC" | "USDC" | "EURC";

export function AssetIcon({ symbol, size = 28 }: { symbol: AssetSymbol; size?: number }) {
  switch (symbol) {
    case "ETH":
      return <EthIcon size={size} />;
    case "cbBTC":
      return <CbBtcIcon size={size} />;
    case "USDC":
      return <UsdcIcon size={size} />;
    case "EURC":
      return <EurcIcon size={size} />;
  }
}
