// Copies DuckDB-WASM into public/duckdb and downloads the extensions it needs, so the site
// never makes a third-party request at runtime (DuckDB would otherwise fetch extensions from
// extensions.duckdb.org). Extensions are pinned by SHA-256: a changed file fails the build.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules", "@duckdb", "duckdb-wasm", "dist");
// Versioned folder, so the files can be cached forever (see vercel.json) and a version bump changes the URL.
const PKG_VERSION = JSON.parse(readFileSync(join(root, "node_modules", "@duckdb", "duckdb-wasm", "package.json"), "utf8")).version;
const publicDir = join(root, "public", "duckdb");
const out = join(publicDir, PKG_VERSION);

// Engine version bundled by @duckdb/duckdb-wasm (pinned in package.json); must match the
// Python duckdb version in requirements.txt so the browser and CLI run the same engine.
export const ENGINE_VERSION = "v1.5.4";
const EXTENSIONS = {
  icu: "ecdbbb29331f72103b8eb227db5792f186b191a4f7a359db8dda9919b0a736de",
  json: "993b19f7929cc305b2529c548f2842e8e7a5b112d1c88f31c84798b51901ca16",
};

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

mkdirSync(out, { recursive: true });
for (const old of existsSync(publicDir) ? readdirSync(publicDir) : []) {
  if (old !== PKG_VERSION) rmSync(join(publicDir, old), { recursive: true, force: true });
}
for (const f of ["duckdb-eh.wasm", "duckdb-browser-eh.worker.js"]) {
  copyFileSync(join(dist, f), join(out, f));
}

const extDir = join(out, "ext", ENGINE_VERSION, "wasm_eh");
mkdirSync(extDir, { recursive: true });
for (const [name, hash] of Object.entries(EXTENSIONS)) {
  const file = join(extDir, `${name}.duckdb_extension.wasm`);
  if (existsSync(file) && sha256(readFileSync(file)) === hash) continue;
  const url = `https://extensions.duckdb.org/${ENGINE_VERSION}/wasm_eh/${name}.duckdb_extension.wasm`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== hash) throw new Error(`checksum mismatch for ${name}: expected ${hash}, got ${got}`);
  writeFileSync(file, buf);
}
console.log(`duckdb ${PKG_VERSION} vendored to public/duckdb/${PKG_VERSION} (engine ${ENGINE_VERSION})`);
