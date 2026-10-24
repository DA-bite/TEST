// Tests the built site in dist/: required files, basic HTML hygiene,
// and that every relative link, stylesheet, script and image resolves.
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const errors = [];
const fail = (msg) => errors.push(msg);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

if (!existsSync(dist)) {
  console.error("dist/ not found. Run `npm run build` first.");
  process.exit(1);
}

for (const required of ["index.html", "404.html", ".nojekyll"]) {
  if (!existsSync(path.join(dist, required))) fail(`dist/${required} is missing`);
}

const files = await walk(dist);
const htmlFiles = files.filter((f) => f.endsWith(".html"));

function resolveTarget(fromFile, ref) {
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean) return null; // pure fragment
  let target = clean.startsWith("/")
    ? path.join(dist, clean)
    : path.resolve(path.dirname(fromFile), clean);
  return target;
}

async function exists(target) {
  if (!existsSync(target)) return false;
  const s = await stat(target);
  if (s.isDirectory()) return existsSync(path.join(target, "index.html"));
  return true;
}

for (const file of htmlFiles) {
  const rel = path.relative(dist, file);
  const html = await readFile(file, "utf8");

  if (!/^\s*<!doctype html>/i.test(html)) fail(`${rel}: missing <!doctype html>`);
  if (!/<html[^>]*\slang=["'][^"']+["']/i.test(html)) fail(`${rel}: <html> needs a lang attribute`);
  if (!/<meta[^>]*charset=/i.test(html)) fail(`${rel}: missing <meta charset>`);
  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) fail(`${rel}: missing viewport meta`);
  const title = html.match(/<title>([^<]*)<\/title>/i);
  if (!title || !title[1].trim()) fail(`${rel}: missing or empty <title>`);
  if ((html.match(/<h1[\s>]/gi) || []).length !== 1) fail(`${rel}: expected exactly one <h1>`);

  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((m) => m[1]));
  const refs = [...html.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi)].map((m) => m[1]);

  for (const ref of refs) {
    if (/^(https?:)?\/\//i.test(ref) || /^(mailto|tel|data):/i.test(ref)) continue;
    if (ref.startsWith("#")) {
      if (ref.length > 1 && !ids.has(ref.slice(1))) fail(`${rel}: broken anchor ${ref}`);
      continue;
    }
    const target = resolveTarget(file, ref);
    if (target && !(await exists(target))) fail(`${rel}: broken link -> ${ref}`);
  }
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}

console.log(`OK: checked ${htmlFiles.length} HTML file(s), no problems found.`);
