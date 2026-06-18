/**
 * Mantua "M" mark — a single transparent-background gradient logo that
 * reads on both light and dark themes, so no per-theme swap is needed.
 *
 * (The old `mantua-logo-light.png` had a dark purple→black square baked
 * into it, so it showed as a black box in light mode. We always use the
 * transparent `mantua-logo-dark.png` instead.)
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <img
      src="/assets/mantua-logo-dark.png"
      width={size}
      height={size}
      alt="Mantua"
      className="block shrink-0"
      style={{ objectFit: "contain" }}
    />
  );
}
