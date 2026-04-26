/**
 * Mantua "M" mark — pulled from the prototype's LogoMark in icons.jsx so the
 * v2 client doesn't depend on the v1 prototype source tree.
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id="mantua-m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b892ff" />
          <stop offset="1" stopColor="#3ddc97" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="52" height="52" rx="14" fill="#0e0e13" stroke="#22222a" />
      <path
        d="M14 42V18l9 14 9-14v24M22 30l-3 4M32 30l-3 4"
        stroke="url(#mantua-m)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
