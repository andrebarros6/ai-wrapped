import { describe, expect, it } from "vitest";

import { DEMO_STATS } from "./demo";
import {
  busiestWeekday,
  clockArchetype,
  clubLine,
  dayLabel,
  decimal,
  defaultOpener,
  defaultPrediction,
  earliestHabit,
  hourLabel,
  peakHour,
  tryAgainVerdict,
  workHeadline,
  workTiles,
} from "./derive";
import { cleanTag, defaultEdits, LIMITS, sanitizeEdits, stripInvisible } from "./edits";
import { isSafeTitle, safeTitles } from "./safety";
import { toCardStats } from "./schema";

describe("derive", () => {
  it("formats hours", () => {
    expect([0, 1, 11, 12, 15, 23].map(hourLabel)).toEqual(["12am", "1am", "11am", "12pm", "3pm", "11pm"]);
  });

  it("finds the peak hour (ties: earliest) and names the clock", () => {
    expect(peakHour({ "9": 5, "16": 9, "20": 9 })).toEqual({ hour: 16, count: 9 });
    expect(peakHour({})).toBeNull();
    expect([6, 10, 16, 19, 23, 2, null].map((h) => clockArchetype(h).name)).toEqual([
      "Early Bird",
      "Morning Mover",
      "Afternoon Operator",
      "Evening Builder",
      "Night Owl",
      "Night Owl",
      "Mystery Clock",
    ]);
    expect(clockArchetype(16).article).toBe("an");
  });

  it("busiest weekday breaks ties by week order", () => {
    expect(busiestWeekday({ Sun: 4, Tue: 4, Mon: 1 })).toBe("Tue");
    expect(busiestWeekday({})).toBeNull();
  });

  it("earliest habit starts the day at 4am and ignores stray messages", () => {
    const byHour: Record<string, number> = { "2": 30, "3": 1, "7": 10, "9": 59 };
    expect(earliestHabit(byHour)).toBe(7); // 3am has 1 of 100 (<2%); 2am counts as last night
    expect(earliestHabit({})).toBeNull();
  });

  it("formats days and decimals", () => {
    expect(dayLabel("2026-02-25")).toBe("25 Feb");
    expect(decimal(7.5)).toBe("7.5");
    expect(decimal(7)).toBe("7");
  });

  it("matches the designs for the demo data", () => {
    expect(workHeadline(DEMO_STATS)).toEqual(["You don't just chat.", "You build."]);
    expect(workTiles(DEMO_STATS)).toEqual([
      { value: 405, label: "chats" },
      { value: 27, label: "projects" },
      { value: 19, label: "design chats" },
      { value: 35, label: "artifacts made" },
      { value: 13, label: "scheduled runs" },
      { value: 1151, label: "web searches" },
    ]);
    expect(clubLine(DEMO_STATS)).toMatch(/^1,151 web searches\. Your role: the /);
    expect(tryAgainVerdict(84, 30)).toBe("Somewhere between demanding and polite.");
  });

  it("skips empty tiles and keeps chats first", () => {
    const s = toCardStats({ chats: 3, web_searches: 2, scheduled_runs: null });
    expect(workTiles(s)).toEqual([
      { value: 3, label: "chats" },
      { value: 2, label: "web searches" },
    ]);
  });

  it("verdicts cover the extremes", () => {
    expect(tryAgainVerdict(0, 0)).toMatch(/Efficient/);
    expect(tryAgainVerdict(2, 10)).toBe("Unfailingly polite.");
    expect(tryAgainVerdict(50, 1)).toMatch(/Demanding/);
  });

  it("default texts are within the edit limits for extreme stats", () => {
    const huge = toCardStats({ chats: 999999, active_days: 366, longest_streak_days: 366, thanks: 999999 });
    expect(defaultOpener(huge).length).toBeLessThanOrEqual(LIMITS.opener);
    for (const line of defaultPrediction(huge)) expect(line.length).toBeLessThanOrEqual(LIMITS.prediction);
    expect(defaultOpener(toCardStats({}))).toMatch(/quiet year/);
  });
});

describe("safety", () => {
  it.each([
    "Receita de bacalhau",
    "Fix my SQL query",
    "Explain transformers",
    "Trip planning for the weekend",
  ])("keeps %j", (t) => expect(isSafeTitle(t)).toBe(true));

  it.each([
    "Doctor appointment notes",
    "Salary negotiation script",
    "Visa paperwork checklist",
    "Rejected after the final round",
    "Message for Maria",
    "Call John tomorrow",
    "my email is a@b.com",
    "Dívida do cartão",
    "Gift ideas for my wife",
    "x",
  ])("drops %j", (t) => expect(isSafeTitle(t)).toBe(false));

  it("dedupes and caps", () => {
    expect(safeTitles(["Fix my SQL query", "Fix my SQL query", "Tax return", "Explain transformers"], 5)).toEqual([
      "Fix my SQL query",
      "Explain transformers",
    ]);
  });
});

describe("edits", () => {
  it("cleans tags", () => {
    expect(cleanTag("#Lisbon Builders!")).toBe("lisbon-builders");
    expect(cleanTag("##acme")).toBe("acme");
    expect(cleanTag("x".repeat(50))).toHaveLength(LIMITS.tag);
    expect(cleanTag(42)).toBe("");
    expect(cleanTag("lisbon ", { typing: true })).toBe("lisbon-");
    expect(cleanTag("lisbon-")).toBe("lisbon");
  });

  it("sanitises untrusted edits and falls back to defaults", () => {
    const s = toCardStats({ chats: 5, active_days: 3, longest_streak_days: 2 });
    const out = sanitizeEdits(
      {
        display_name: "  André\u0000  ",
        tag: "#Team A",
        opener: "",
        prediction: ["a".repeat(200), 7],
        chattiest_day_example: "line\nbreak",
        theme: "neon",
      },
      s,
    );
    expect(out.display_name).toBe("André");
    expect(out.tag).toBe("team-a");
    expect(out.opener).toBe(defaultEdits(s).opener);
    expect(out.prediction[0]).toHaveLength(LIMITS.prediction);
    expect(out.prediction[1]).toBe(defaultEdits(s).prediction[1]);
    expect(out.chattiest_day_example).toBe("line break");
    expect(out.theme).toBe("brand");
    expect(sanitizeEdits(null, s)).toEqual(defaultEdits(s));
  });
});

describe("invisible characters", () => {
  it("strips bidi overrides and zero-width characters but keeps emoji joiners", () => {
    const rlo = String.fromCodePoint(0x202e);
    const zwsp = String.fromCodePoint(0x200b);
    const coder = "👩" + String.fromCodePoint(0x200d) + "💻";
    expect(stripInvisible(`${rlo}evil${zwsp}name`)).toBe("evilname");
    expect(stripInvisible(coder)).toBe(coder);
    const s = toCardStats({ chats: 1 });
    expect(sanitizeEdits({ display_name: `${rlo}Ana`, opener: `hi${zwsp}there` }, s)).toMatchObject({
      display_name: "Ana",
      opener: "hithere",
    });
  });
});

describe("schema", () => {
  it("never throws and clamps bad values", () => {
    const s = toCardStats({ chats: -4, night_share: 7, club: "Hackers", by_hour: "nope", chattiest_day: { date: "bad" } });
    expect(s.chats).toBe(0);
    expect(s.night_share).toBe(0);
    expect(s.club).toBe("Talkers");
    expect(s.by_hour).toEqual({});
    expect(s.chattiest_day).toBeNull();
    expect(toCardStats(null).chats).toBe(0);
  });
});
