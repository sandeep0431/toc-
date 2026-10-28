import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

export default defineConfig({
  // Use relative base path so assets load correctly on GitHub Pages (e.g. /repo-name/)
  base: "./",
  resolve: {
    alias: {
      "@tripwire/engine": path.resolve(__dirname, "../../packages/engine/src/index.ts"),
    },
  },
  plugins: [
    react(),
    {
      name: "copy-404-for-github-pages",
      closeBundle() {
        const distDir = path.resolve(__dirname, "dist");
        const indexPath = path.join(distDir, "index.html");
        const notFoundPath = path.join(distDir, "404.html");
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, notFoundPath);
        }
      },
    },
  ],
  server: {
    port: 5173,
  },
});
