import { useTheme } from "@/hooks/use-theme.tsx";

/**
 * Mantua "M" mark — uses the artist-supplied PNGs in
 * `public/assets/`. The `*-dark.png` variant has a black background
 * (worn over the dark theme) and the `*-light.png` variant has a white
 * background (worn over the light theme).
 */
export function Logo({ size = 30 }: { size?: number }) {
  const { theme } = useTheme();
  const src = theme === "light" ? "/assets/mantua-logo-light.png" : "/assets/mantua-logo-dark.png";
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Mantua"
      className="block shrink-0"
      style={{ objectFit: "contain" }}
    />
  );
}
