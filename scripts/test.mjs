// Tests the built site in dist/. Run `npm run build` first.
//
// Reports every problem it finds, then exits with an error if there were any.
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

// Same value the build used. Only 404.html contains paths that start with it.
const base = (process.env.SITE_BASE || "").replace(/\/+$/, "");

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

// Read every page once, along with the ids it defines. Code samples inside <pre>
// are text, not live markup, so they're left out of the id, link and image checks.
const pages = new Map();
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const markup = html.replace(/<pre\b[\s\S]*?<\/pre>/gi, "");
  const ids = new Set([...markup.matchAll(/\sid=["']([^"']+)["']/gi)].map((m) => m[1]));
  pages.set(file, { html, markup, ids });
}

// Turn a link found in `fromFile` into a path inside dist/, or null if it isn't an internal file.
function resolveTarget(fromFile, ref) {
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean) return null;
  if (clean.startsWith("/")) {
    let p = clean;
    if (base && (p === base || p.startsWith(base + "/"))) p = p.slice(base.length) || "/";
    return path.join(dist, p);
  }
  return path.resolve(path.dirname(fromFile), clean);
}

async function exists(target) {
  if (!existsSync(target)) return false;
  const s = await stat(target);
  if (s.isDirectory()) return existsSync(path.join(target, "index.html"));
  return true;
}

function pageFor(target) {
  if (target.endsWith(".html")) return pages.get(target);
  return pages.get(path.join(target, "index.html"));
}

for (const [file, { html, markup, ids }] of pages) {
  const rel = path.relative(dist, file);

  // Document basics
  if (!/^\s*<!doctype html>/i.test(html)) fail(`${rel}: missing <!doctype html>`);
  if (!/<html[^>]*\slang=["'][^"']+["']/i.test(html)) fail(`${rel}: <html> needs a lang attribute`);
  if (!/<meta[^>]*charset=/i.test(html)) fail(`${rel}: missing <meta charset>`);
  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) fail(`${rel}: missing viewport meta`);
  const title = html.match(/<title>([^<]*)<\/title>/i);
  if (!title || !title[1].trim()) fail(`${rel}: missing or empty <title>`);
  if ((markup.match(/<h1[\s>]/gi) || []).length !== 1) fail(`${rel}: expected exactly one <h1>`);

  // Build leftovers
  if (/\{\{\s*(root|base)\s*\}\}/.test(html) || /<!--\s*@include\b/.test(html)) {
    fail(`${rel}: unexpanded placeholder or include marker`);
  }

  // Unique ids
  const seen = new Set();
  for (const m of markup.matchAll(/\sid=["']([^"']+)["']/gi)) {
    if (seen.has(m[1])) fail(`${rel}: duplicate id "${m[1]}"`);
    seen.add(m[1]);
  }

  // Images need alt text (alt="" is fine for decorative images)
  for (const m of markup.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\salt=/.test(m[0])) fail(`${rel}: image is missing alt text: ${m[0].slice(0, 60)}`);
  }

  // Links, images, stylesheets and scripts
  const refs = [...markup.matchAll(/\s(?:href|src)=["']([^"']*)["']/gi)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:)?\/\//i.test(ref) || /^(mailto|tel|data|javascript):/i.test(ref)) continue;

    if (ref.startsWith("#")) {
      if (ref.length > 1 && !ids.has(ref.slice(1))) fail(`${rel}: broken anchor ${ref}`);
      continue;
    }

    // Only 404.html may start a path with "/". Pages serves it from any depth.
    if (ref.startsWith("/") && rel !== "404.html") {
      fail(`${rel}: link starts with "/" and will break on a project page: ${ref}`);
      continue;
    }

    const target = resolveTarget(file, ref);
    if (!target) continue;
    if (!(await exists(target))) {
      fail(`${rel}: broken link -> ${ref}`);
      continue;
    }

    // Links to a section of another page
    const hash = ref.includes("#") ? ref.split("#")[1] : "";
    if (hash) {
      const other = pageFor(target);
      if (other && !other.ids.has(hash)) fail(`${rel}: broken anchor ${ref}`);
    }
  }
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}

console.log(`OK: checked ${htmlFiles.length} HTML file(s), no problems found.`);
