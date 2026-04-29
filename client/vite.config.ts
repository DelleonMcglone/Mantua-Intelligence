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
  server: {
    port: 5173,
    strictPort: true,
    https: {},
    /**
     * Forward `/api` requests to the Express server so the browser
     * stays on `https://localhost:5173` and avoids mixed-content
     * blocks (https → http on `:3001`). The server stays plain HTTP
     * locally; production goes via Vercel + a dedicated API host
     * with real TLS.
     */
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
