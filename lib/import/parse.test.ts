import { describe, expect, it } from "vitest";

import { golden } from "@/e2e/fixtures";

import { ImportError, MAX_PASTE_CHARS, parseImport } from "./parse";

const LITE = {
  version: 1,
  source: "lite-prompt",
  platform: "Claude",
  chats: 140,
  your_messages: 900,
  active_days: 80,
  web_searches: 60,
  projects_total: 4,
  night_share: 0.2,
  languages: 3,
  club: "Builders",
  opener: "A year of side projects.",
  prediction: ["Ship one more.", "Sleep more.", 42],
};

describe("parseImport", () => {
  it("reads raw CLI output (exact), keeping titles local", () => {
    const full = golden("edge-cases", "Europe/Lisbon");
    const out = parseImport(JSON.stringify(full));
    expect(out.source).toBe("cli");
    expect(out.split.shareable.chats).toBe(full.chats);
    expect(out.split.shareable.longest_chat_messages).toBe((full.longest_chat as [number, string])[0]);
    expect(JSON.stringify(out.split.shareable)).not.toContain((full.chat_titles as string[])[0]);
  });

  it("reads the full prompt kit's reply inside a code fence with chatter", () => {
    const full = golden("sample-export", "UTC");
    const kit = { version: 1, source: "full-prompt", year: 2026, tz: "Asia/Kolkata", chats: full.chats, by_hour: full.by_hour, longest_chat_messages: 9 };
    const out = parseImport(`Here you go:\n\`\`\`json\n${JSON.stringify(kit, null, 2)}\n\`\`\`\nEnjoy!`);
    expect(out.source).toBe("full-prompt");
    expect(out.tz).toBe("Asia/Kolkata");
    expect(out.split.shareable.longest_chat_messages).toBe(9);
  });

  it("maps the lite prompt's estimates and keeps its text as starting edits", () => {
    const out = parseImport(JSON.stringify(LITE));
    expect(out.source).toBe("lite-prompt");
    expect(out.split.shareable).toMatchObject({ chats: 140, your_messages: 900, club: "Builders", night_share: 0.2 });
    expect(Object.keys(out.split.shareable.languages_first_msg as object)).toHaveLength(3);
    expect(out.edits).toEqual({ opener: "A year of side projects.", prediction: ["Ship one more.", "Sleep more."] });
    expect(out.tz).toBe("UTC");
  });

  it("turns the lite rhythm estimates into counts the clock, busiest-day and try-again cards use", () => {
    const hours = Array.from({ length: 24 }, (_, h) => (h === 16 ? 0.5 : h === 9 ? 0.25 : h === 23 ? 0.25 : 0));
    const out = parseImport(
      JSON.stringify({
        ...LITE,
        thanks: 30,
        retries: 84,
        by_hour: hours,
        by_weekday: [1, 1, 1, 1, 1, 0, 0],
        chattiest_day: { date: "2026-02-25", messages: 36, topics: 6 },
      }),
    );
    expect(out.split.shareable).toMatchObject({
      thanks: 30,
      retries: 84,
      by_hour: { "9": 225, "16": 450, "23": 225 },
      by_weekday: { Mon: 180, Tue: 180, Wed: 180, Thu: 180, Fri: 180 },
      chattiest_day: { date: "2026-02-25", messages: 36, topics: 6 },
    });
  });

  it.each([
    ["wrong length", { by_hour: [1, 2, 3], by_weekday: [1] }],
    ["all zero", { by_hour: Array(24).fill(0), by_weekday: Array(7).fill(0) }],
    ["not arrays", { by_hour: { "16": 5 }, by_weekday: "Mon" }],
  ])("drops a malformed rhythm estimate (%s)", (_name, bad) => {
    const out = parseImport(JSON.stringify({ ...LITE, ...bad }));
    expect(out.split.shareable).not.toHaveProperty("by_hour");
    expect(out.split.shareable).not.toHaveProperty("by_weekday");
  });

  it.each([
    ["placeholder date", { date: "2026-MM-DD", messages: 5, topics: 1 }],
    ["another year", { date: "2025-12-31", messages: 5, topics: 1 }],
    ["impossible date", { date: "2026-13-01", messages: 5, topics: 1 }],
    ["no messages", { date: "2026-02-25", messages: 0, topics: 0 }],
    ["not an object", "Feb 25"],
  ])("drops a chattiest day that isn't usable (%s)", (_name, chattiest_day) => {
    expect(parseImport(JSON.stringify({ ...LITE, chattiest_day })).split.shareable).not.toHaveProperty("chattiest_day");
  });

  it("accepts the old lite format's estimate fields", () => {
    const out = parseImport(JSON.stringify({ source: "lite-prompt", chats_estimate: 50, night_share_estimate: 0.1 }));
    expect(out.split.shareable).toMatchObject({ chats: 50, night_share: 0.1 });
  });

  it.each([
    ["nothing", ""],
    ["prose", "Sorry, I can't access your chats."],
    ["broken JSON", '{"chats": 3,'],
    ["an array", "[1,2,3]"],
    ["some other JSON", '{"hello": "world"}'],
    ["lite without chats", '{"source": "lite-prompt"}'],
    ["too long", "{" + "x".repeat(MAX_PASTE_CHARS) + "}"],
  ])("rejects %s with a clear message", (_name, text) => {
    expect(() => parseImport(text)).toThrow(ImportError);
  });

  it("ignores an invalid timezone", () => {
    expect(parseImport(JSON.stringify({ ...LITE, tz: "Mars/Base'; --" })).tz).toBe("UTC");
  });
});
