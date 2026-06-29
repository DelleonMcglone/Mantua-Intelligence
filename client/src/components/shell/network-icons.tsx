/**
 * Network logos for the chatbot's chain switcher — replaces the plain
 * brand-color dots. Inline SVGs so they render without extra requests
 * and scale crisply at any chip size.
 *   - Base: blue rounded square.
 *   - Arc: navy gradient tile with the silver arch mark.
 * Gradient ids are de-duped with `useId()` so multiple instances on the
 * same page (chip + dropdown item) don't collide.
 */

import { useId } from "react";
import type { NetworkKey } from "@/lib/chains.ts";

interface LogoProps {
  size?: number;
}

export function BaseLogo({ size = 16 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="#0000ff" />
    </svg>
  );
}

export function ArcLogo({ size = 16 }: LogoProps) {
  const uid = useId();
  const bgId = `arc-bg-${uid}`;
  const archId = `arc-arch-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#244a82" />
          <stop offset="100%" stopColor="#0a1730" />
        </linearGradient>
        <linearGradient id={archId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#9fb2c7" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="7" fill={`url(#${bgId})`} />
      <path
        d="M7 26 C7 13 10.5 6 16 6 C21.5 6 25 13 25 26 L20.5 26 C20.5 15.5 18.5 10.5 16 10.5 C13.5 10.5 11.5 15.5 11.5 26 Z"
        fill={`url(#${archId})`}
      />
      <rect x="10" y="19.5" width="12.5" height="3" rx="1.5" fill={`url(#${archId})`} />
    </svg>
  );
}

/** Circle brand mark — a green circle with a white ring. Used in the landing
 *  header's "Powered by Circle" badge. */
export function CircleLogo({ size = 16 }: LogoProps) {
  const uid = useId();
  const gId = `circle-g-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5FD3A3" />
          <stop offset="50%" stopColor="#5FA0E8" />
          <stop offset="100%" stopColor="#9B7FE3" />
        </linearGradient>
      </defs>
      {/* Concentric broken arcs forming Circle's "C" mark, gaps offset for the
          pinwheel look; green→blue→purple gradient. */}
      <circle
        cx="16"
        cy="16"
        r="11"
        fill="none"
        stroke={`url(#${gId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="68 32"
        transform="rotate(-40 16 16)"
      />
      <circle
        cx="16"
        cy="16"
        r="6.4"
        fill="none"
        stroke={`url(#${gId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="60 40"
        transform="rotate(150 16 16)"
      />
      <circle cx="16" cy="16" r="2.3" fill={`url(#${gId})`} />
    </svg>
  );
}

export function NetworkLogo({ network, size = 16 }: { network: NetworkKey; size?: number }) {
  switch (network) {
    // `network` is a single-value union today; the switch is kept so adding
    // a NetworkKey forces a new case here.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "arc":
      return <ArcLogo size={size} />;
  }
}
