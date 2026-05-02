import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * Dev runs on plain HTTP at `http://localhost:5173`. `localhost` is one
 * of the few origins the spec explicitly grants a "secure context" to
 * even over HTTP, so Privy's Web Crypto API key sharding still works.
 * Plain HTTP also lets the Claude Code preview pane render the app
 * (it can't accept a self-signed cert).
 *
 * Staging / prod must serve over real TLS (Vercel handles the frontend).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5173,
    strictPort: true,
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
