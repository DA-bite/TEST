// Builds the site: copies site/ into dist/ and adds .nojekyll.
import { cp, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "site");
const out = path.join(root, "dist");

if (!existsSync(src)) {
  console.error("Missing site/ directory");
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(src, out, { recursive: true });

// Tell GitHub Pages not to run Jekyll over the output.
await writeFile(path.join(out, ".nojekyll"), "");

console.log("Built site/ -> dist/");
