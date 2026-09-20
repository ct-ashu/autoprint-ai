import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const source = path.dirname(require.resolve("pdfjs-dist/package.json"));
const target = fileURLToPath(
  new URL("../frontend/public/pdf-assets/", import.meta.url),
);
await fs.mkdir(target, { recursive: true });
await fs.copyFile(
  path.join(source, "build/pdf.worker.min.mjs"),
  path.join(target, "pdf.worker.min.mjs"),
);
for (const folder of ["cmaps", "standard_fonts", "wasm"])
  await fs.cp(path.join(source, folder), path.join(target, folder), {
    recursive: true,
  });
