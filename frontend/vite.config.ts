import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
    // Allow the dev server to serve the frozen contract and (later) Person C's
    // shared fixtures from ../shared. Build output is unaffected.
    fs: {
      allow: [projectRoot, repoRoot],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
      "@shared": `${repoRoot}shared`,
    },
  },
});
