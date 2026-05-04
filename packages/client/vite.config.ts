import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Resolve the workspace engine directly from its TypeScript source so
      // we don't need a build step on the engine package during dev.
      "@bourbonomics/engine": path.resolve(__dirname, "../engine/src/index.ts"),
    },
  },
  server: {
    port: 5173,
  },
});
