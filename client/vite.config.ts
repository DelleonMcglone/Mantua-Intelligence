import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";

/**
 * P2-015 — HTTPS dev requirement. Privy's Web Crypto API key sharding
 * silently fails over plain HTTP outside `localhost`. `@vitejs/plugin-
 * basic-ssl` issues a self-signed cert so dev runs over HTTPS by default.
 *
 * For staging/prod, use real TLS (Vercel handles this for the frontend).
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: { port: 5173, strictPort: true, https: {} },
});
