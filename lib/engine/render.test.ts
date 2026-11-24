import { describe, expect, it } from "vitest";

import { splitStatements } from "./engine";
import { detectTimeZone, isValidTimeZone, render } from "./render";
import { LOAD_SQL, METRICS } from "./sql.generated";

describe("render (same contract as scripts/wrapped.py)", () => {
  it("quotes the conversations path and fills tz/year", () => {
    expect(render("SELECT {{conversations}}, '{{tz}}', {{year}}", { conversations: "C:\\it's\\c.json", tz: "UTC", year: 2026 })).toBe(
      "SELECT 'C:/it''s/c.json', 'UTC', 2026",
    );
  });

  it.each(["Europe/Lisbon'; DROP TABLE chats; --", "", "../etc", "Europe/Lisbon OR 1=1"])("rejects %j", (tz) => {
    expect(() => render("{{tz}}", { conversations: "x", tz, year: 2026 })).toThrow(/invalid timezone/);
  });
});

describe("isValidTimeZone", () => {
  it.each(["UTC", "Europe/Lisbon", "America/Argentina/Buenos_Aires", "Etc/GMT+5"])("accepts %s", (tz) => {
    expect(isValidTimeZone(tz)).toBe(true);
  });
  it.each(["Mars/Olympus", "Europe/Lisbon'", "", "x".repeat(80)])("rejects %j", (tz) => {
    expect(isValidTimeZone(tz)).toBe(false);
  });
  it("detects a valid zone", () => {
    expect(isValidTimeZone(detectTimeZone())).toBe(true);
  });
});

describe("bundled SQL", () => {
  it("contains every metric file in order", () => {
    expect(METRICS.map((m) => m.name)).toEqual([
      "10_volume.sql",
      "20_time.sql",
      "30_text.sql",
      "40_tools.sql",
      "50_language.sql",
      "60_chats.sql",
      "70_surfaces.sql",
      "90_club.sql",
    ]);
  });

  it("splits the loader into whole statements", () => {
    const stmts = splitStatements(LOAD_SQL);
    expect(stmts.length).toBeGreaterThanOrEqual(10);
    expect(stmts.every((s) => /^(--[^\n]*\n\s*)*(CREATE|SELECT)/i.test(s))).toBe(true);
    for (const m of METRICS) expect(splitStatements(m.sql)).toHaveLength(1);
  });
});
