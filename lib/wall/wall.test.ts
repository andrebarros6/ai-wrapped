import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FIXTURES, golden, ROOT, TIMEZONES } from "@/e2e/fixtures";
import { splitStats } from "@/lib/engine/stats";
import { DEMO_STATS } from "@/lib/story/demo";
import { toCardStats } from "@/lib/story/schema";

import { buildEntry, entryFileName, githubNewFileUrl, isEligible, NAME_RE } from "./entry";
import { type Distribution, rankLines, topPercent } from "./rank";

const PYTHON = process.platform === "win32" ? "python" : "python3";

/** Run the real Python validator (scripts/wall.py) on entries built by the site. */
function pythonValidates(entries: unknown[]): string[] {
  const code = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(join(ROOT, "scripts"))})`,
    "import wall",
    "out = []",
    "for e in json.load(sys.stdin):",
    "    try:",
    "        wall.validate_entry(e); out.append('ok')",
    "    except wall.EntryError as err:",
    "        out.append(str(err))",
    "print(json.dumps(out))",
  ].join("\n");
  const stdout = execFileSync(PYTHON, ["-c", code], {
    input: JSON.stringify(entries),
    encoding: "utf8",
    env: { ...process.env, PYTHONUTF8: "1" }, // Windows defaults stdin to cp1252
  });
  return JSON.parse(stdout) as string[];
}

describe("wall entry", () => {
  it("entries the site builds pass the Python validator, for every golden output", () => {
    const entries = FIXTURES.flatMap((f) =>
      TIMEZONES.map((tz) => buildEntry(toCardStats(splitStats(golden(f, tz)).shareable), "Ana Silva", "#Lisbon Builders")),
    );
    entries.push(buildEntry(DEMO_STATS, "André", "barrosbuilds"));
    expect(pythonValidates(entries)).toEqual(entries.map(() => "ok"));
  });

  it("carries no titles, words or free text", () => {
    const full = golden("edge-cases", "UTC");
    const entry = buildEntry(toCardStats(splitStats(full).shareable), "Ana", "");
    const json = JSON.stringify(entry);
    for (const t of full.chat_titles as string[]) expect(json).not.toContain(t);
    expect(Object.keys(entry).sort()).toEqual(["display_name", "source", "stats", "tag", "version", "year"]);
  });

  it("only exact stats are eligible", () => {
    expect(isEligible(DEMO_STATS)).toBe(true);
    expect(isEligible(toCardStats({ source: "lite-prompt", chats: 3 }))).toBe(false);
  });

  it("names and file names", () => {
    expect(NAME_RE.test("José O'Neill-Silva")).toBe(true);
    expect(NAME_RE.test("see https://x.y")).toBe(false);
    expect(entryFileName("José O'Neill", "3fa91c")).toBe("jose-o-neill-3fa91c.json");
    expect(entryFileName("???", "000000")).toBe("anon-000000.json");
    expect(entryFileName("x".repeat(80), "abcdef")).toMatch(/^x{40}-abcdef\.json$/);
    expect(entryFileName("Ana")).toMatch(/^ana-[a-f0-9]{6}\.json$/);
  });

  it("builds a prefilled GitHub new-file link", () => {
    const entry = buildEntry(DEMO_STATS, "André", "barrosbuilds");
    const url = new URL(githubNewFileUrl(entry, "andre-abc123.json"));
    expect(url.origin + url.pathname).toBe("https://github.com/andrebarros6/ai-wrapped/new/main");
    expect(url.searchParams.get("filename")).toBe("wall/entries/andre-abc123.json");
    expect(JSON.parse(url.searchParams.get("value")!)).toEqual(entry);
    expect(url.toString().length).toBeLessThan(4_000);
  });
});

describe("rank lines", () => {
  const linear = Array.from({ length: 101 }, (_, i) => i); // percentile i has value i

  it("topPercent", () => {
    expect(topPercent(100, linear)).toBe(1);
    expect(topPercent(92, linear)).toBe(9);
    expect(topPercent(0, linear)).toBe(100);
    expect(topPercent(5, [1, 2])).toBe(100); // malformed table: no claim
  });

  it("shows only top-quarter ranks, best first, and none before the Wall is big enough", () => {
    const d: Distribution = {
      version: 1,
      count: 40,
      min_entries: 20,
      metrics: { web_searches: linear, chats: linear.map((x) => x * 10), thanks: linear },
    };
    const s = toCardStats({ web_searches: 95, chats: 800, thanks: 10 });
    expect(rankLines(s, d)).toEqual([
      { metric: "web_searches", label: "web searches", top: 6 },
      { metric: "chats", label: "chats started", top: 21 },
    ]);
    expect(rankLines(s, { ...d, metrics: null })).toEqual([]);
  });
});
