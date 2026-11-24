import { describe, expect, it } from "vitest";

import { FIXTURES, golden, TIMEZONES } from "@/e2e/fixtures";

import { SHAREABLE_METRICS, splitStats } from "./stats";

/** Every string *value* (not key) anywhere in a JSON-like value. */
function stringValues(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(stringValues);
  if (v && typeof v === "object") return Object.values(v).flatMap(stringValues);
  return [];
}

describe("splitStats", () => {
  it.each(FIXTURES.flatMap((f) => TIMEZONES.map((tz) => [f, tz])))(
    "%s %s: shareable stats contain no titles or own words",
    (fixture, tz) => {
      const full = golden(fixture, tz);
      const { shareable, local } = splitStats(full);
      const values = stringValues(shareable);
      for (const title of full.chat_titles as string[]) expect(values).not.toContain(title);
      for (const word of full.your_top_words as string[]) expect(values).not.toContain(word);
      expect(shareable).not.toHaveProperty("chat_titles");
      expect(shareable).not.toHaveProperty("your_top_words");
      expect(shareable).not.toHaveProperty("longest_chat");
      expect(shareable.longest_chat_messages).toBe((full.longest_chat as [number, string])[0]);
      expect(local.chat_titles).toEqual(full.chat_titles);
      expect(local.chattiest_day_titles).toEqual(full.chattiest_day_titles);
      expect(shareable).not.toHaveProperty("chattiest_day_titles");
      expect(local.longest_chat_title).toBe((full.longest_chat as [number, string])[1]);
    },
  );

  it("is an allow-list: unknown keys are dropped", () => {
    const { shareable } = splitStats({ chats: 3, brand_new_metric: "secret" });
    expect(shareable).toEqual({ chats: 3, longest_chat_messages: null });
  });

  it("covers every metric the engine produces except local-only ones", () => {
    const keys = Object.keys(golden("edge-cases", "UTC")).filter(
      (k) => !["chat_titles", "chattiest_day_titles", "your_top_words", "longest_chat"].includes(k),
    );
    expect([...keys].sort()).toEqual([...SHAREABLE_METRICS].sort());
  });
});
