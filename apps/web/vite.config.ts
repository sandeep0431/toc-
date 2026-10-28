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
      name: "copy-404-and-root-dist",
      closeBundle() {
        const distDir = path.resolve(__dirname, "dist");
        const indexPath = path.join(distDir, "index.html");
        const notFoundPath = path.join(distDir, "404.html");
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, notFoundPath);
        }

        // Copy build output to root dist directory so Vercel finds ./dist at monorepo root
        const rootDistDir = path.resolve(__dirname, "../../dist");
        try {
          if (fs.existsSync(distDir)) {
            fs.mkdirSync(rootDistDir, { recursive: true });
            fs.cpSync(distDir, rootDistDir, { recursive: true, force: true });
          }
        } catch (err) {
          console.warn("Could not copy build output to root dist:", err);
        }
      },
    },
  ],
  server: {
    port: 5173,
  },
});
