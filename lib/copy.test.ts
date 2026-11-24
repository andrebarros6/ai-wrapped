// House rule (shared with barrosbuilds.com): no em dashes in anything a visitor sees. Scans the
// site's pages and components, the card text logic, the SQL shown by "Show the query" and the
// prompts shown on /import. Code comments don't count; an em dash quoted as data ("—", the
// character the em-dash metric counts) is allowed.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const EM_DASH = "—";

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p, exts);
    return exts.some((e) => p.endsWith(e)) && !/\.test\.tsx?$|\.generated\.ts$/.test(p) ? [p] : [];
  });
}

const stripComments = (code: string): string =>
  code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1"); // line comments (not URLs or strings)

const FILES = [
  ...walk(join(ROOT, "app"), [".tsx", ".ts"]),
  ...walk(join(ROOT, "components"), [".tsx"]),
  ...walk(join(ROOT, "lib", "story"), [".ts"]),
  ...walk(join(ROOT, "sql", "metrics"), [".sql"]),
  ...walk(join(ROOT, "prompts"), [".md"]),
];

describe("visitor-facing copy", () => {
  it("scans a meaningful set of files", () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  it("has no em dashes", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const raw = readFileSync(file, "utf8");
      const text = /\.(tsx?)$/.test(file) ? stripComments(raw) : raw;
      text.split("\n").forEach((line, i) => {
        const prose = line.replace(new RegExp(`["']${EM_DASH}["']`, "g"), "");
        if (prose.includes(EM_DASH)) offenders.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
