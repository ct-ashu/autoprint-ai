import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig(async ({ command }) => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  // Starting in frontend/ uses the requested Flask API. Starting at the project root runs the hosted API adapter.
  const standalone = path.resolve(process.cwd()) === path.resolve(root);
  const plugins = [react()];
  if (command === "serve" && !standalone) {
    // Keep the optional Worker adapter out of standalone Flask builds.
    const { previewAPI } = await import(
      new URL("../scripts/preview-api.mjs", import.meta.url).href
    );
    plugins.push(previewAPI(path.dirname(root)));
  }
  return {
    root,
    plugins,
    server: {
      host: "0.0.0.0",
      port: 4173,
      strictPort: true,
      allowedHosts: ["terminal.local"],
      ...(standalone
        ? {
            proxy: {
              "/api": { target: "http://127.0.0.1:5000", changeOrigin: true },
            },
          }
        : {}),
    },
    build: { outDir: "../dist/client", emptyOutDir: true },
  };
});
