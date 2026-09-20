import { build } from "esbuild";
import fs from "node:fs/promises";
await fs.mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["worker/index.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/server/index.js",
  minify: true,
});
await fs.mkdir("dist/.openai", { recursive: true });
await fs.copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await fs.cp("drizzle", "dist/.openai/drizzle", { recursive: true });
await fs.writeFile(
  "dist/server/wrangler.json",
  JSON.stringify(
    {
      name: "autoprint-ai",
      main: "index.js",
      compatibility_date: "2026-05-15",
      assets: { directory: "../client", binding: "ASSETS" },
      d1_databases: [
        {
          binding: "DB",
          database_name: "autoprint-ai",
          database_id: "local",
          migrations_dir: "../.openai/drizzle",
        },
      ],
      r2_buckets: [{ binding: "BUCKET", bucket_name: "autoprint-documents" }],
    },
    null,
    2,
  ),
);
console.log("Worker, client assets, and database migrations built.");
