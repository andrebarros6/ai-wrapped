// Serves the static export (out/) under /wrapped, like production. Used by Playwright.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const OUT = join(process.cwd(), "out");
const BASE = "/wrapped";
const PORT = Number(process.env.PORT ?? 4317);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function resolve(pathname) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  if (rel.startsWith("..")) return null;
  for (const candidate of [rel, `${rel}.html`, join(rel, "index.html")]) {
    const file = join(OUT, candidate);
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/" || pathname === BASE) {
    res.writeHead(308, { location: `${BASE}/` }).end();
    return;
  }
  const file = pathname.startsWith(`${BASE}/`) ? resolve(pathname.slice(BASE.length)) : null;
  if (!file) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`serving out/ at http://127.0.0.1:${PORT}${BASE}/`));
