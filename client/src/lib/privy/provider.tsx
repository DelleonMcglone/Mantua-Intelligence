import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID, privyConfig } from "./config.ts";

export function MantuaPrivyProvider({ children }: { children: ReactNode }) {
  // Render a visible error rather than throwing at module load — a
  // top-level throw blanks the entire page on Vercel when the env var
  // isn't configured, with no on-screen hint at what went wrong.
  if (!PRIVY_APP_ID) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#0b0b0f",
          color: "#e6e6ea",
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
            Mantua: configuration error
          </h1>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.5, opacity: 0.85 }}>
            <code>VITE_PRIVY_APP_ID</code> is not set on this deployment. Add it to the Vercel
            project's Environment Variables (Production + Preview) and redeploy. See{" "}
            <code>client/.env.example</code> for the full list.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      {children}
    </PrivyProvider>
  );
}
