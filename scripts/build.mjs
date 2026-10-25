// Builds the site: copies site/ into dist/, expands partials, and resolves paths.
//
//   <!-- @include name -->   is replaced with site/partials/name.html
//   {{root}}                 is replaced with the relative path back to the site root
//                            ("./" on the home page, "../" one level down, and so on)
//   {{base}}                 is replaced with the SITE_BASE environment variable ("" by default)
//
// Because every path is relative, the site works under /<repo>/ on GitHub Pages
// and on a custom domain without any configuration.
import { cp, rm, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "site");
const out = path.join(root, "dist");
const partialsDir = path.join(src, "partials");

if (!existsSync(src)) {
  console.error("Missing site/ directory");
  process.exit(1);
}

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

// Load partials once.
const partials = new Map();
if (existsSync(partialsDir)) {
  for (const file of await walk(partialsDir)) {
    if (!file.endsWith(".html")) continue;
    partials.set(path.basename(file, ".html"), await readFile(file, "utf8"));
  }
}

// The path the site is served from, such as "/my-repo" on a project page or "" on a
// custom domain. The deploy workflow sets SITE_BASE from actions/configure-pages.
// Only 404.html needs it: Pages serves that file for any missing URL, so a relative
// path would resolve against the wrong folder.
const base = (process.env.SITE_BASE || "").replace(/\/+$/, "");

const INCLUDE = /<!--\s*@include\s+([\w-]+)\s*-->/g;

function expand(html, fileLabel) {
  // Allow partials to include other partials, up to a sensible depth.
  for (let depth = 0; depth < 5 && INCLUDE.test(html); depth++) {
    INCLUDE.lastIndex = 0;
    html = html.replace(INCLUDE, (_, name) => {
      if (!partials.has(name)) {
        throw new Error(`${fileLabel}: unknown partial "${name}"`);
      }
      return partials.get(name);
    });
  }
  INCLUDE.lastIndex = 0;
  return html;
}

function rootPrefix(fileInDist) {
  const rel = path.relative(path.dirname(fileInDist), out).split(path.sep).join("/");
  return rel === "" ? "./" : `${rel}/`;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(src, out, { recursive: true });
await rm(path.join(out, "partials"), { recursive: true, force: true });

let pages = 0;
for (const file of await walk(out)) {
  if (!file.endsWith(".html")) continue;
  const label = path.relative(out, file);
  let html = await readFile(file, "utf8");
  try {
    html = expand(html, label);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  html = html.replaceAll("{{root}}", rootPrefix(file)).replaceAll("{{base}}", base);
  await writeFile(file, html);
  pages++;
}

// Tell GitHub Pages not to run Jekyll over the output.
await writeFile(path.join(out, ".nojekyll"), "");

console.log(`Built site/ -> dist/ (${pages} pages)`);
