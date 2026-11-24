import { deflateSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { FIXTURES, golden, TIMEZONES } from "@/e2e/fixtures";
import { splitStats } from "@/lib/engine/stats";
import { DEMO_EDITS, DEMO_STATS } from "@/lib/story/demo";
import { defaultEdits } from "@/lib/story/edits";
import { toCardStats } from "@/lib/story/schema";

import { decodeShare, encodeShare, MAX_TOKEN_CHARS, splitPair, tokenFromInput } from "./codec";
import { compare } from "./compare";

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const tokenOf = (value: unknown) => b64url(deflateSync(strToU8(JSON.stringify(value))));

describe("share codec", () => {
  it("round-trips the demo exactly", () => {
    const token = encodeShare(DEMO_STATS, DEMO_EDITS);
    expect(decodeShare(token)).toEqual({ stats: DEMO_STATS, edits: DEMO_EDITS });
  });

  it.each(FIXTURES.flatMap((f) => TIMEZONES.map((tz) => [f, tz])))(
    "%s %s: round-trips, stays small and carries no titles",
    (fixture, tz) => {
      const full = golden(fixture, tz);
      const stats = toCardStats(splitStats(full).shareable);
      const token = encodeShare(stats, defaultEdits(stats));
      expect(token.length).toBeLessThan(2_000);
      expect(decodeShare(token)?.stats).toEqual(stats);
      const json = JSON.stringify(decodeShare(token));
      for (const t of full.chat_titles as string[]) expect(json).not.toContain(t);
    },
  );

  it("only encodes allow-listed keys", () => {
    const sneaky = { ...DEMO_STATS, chat_titles: ["secret title"], your_top_words: ["secret"] } as typeof DEMO_STATS;
    const decoded = decodeShare(encodeShare(sneaky, { ...DEMO_EDITS, extra: "x" } as typeof DEMO_EDITS));
    expect(JSON.stringify(decoded)).not.toContain("secret");
    expect(JSON.stringify(decoded)).not.toContain("extra");
  });

  it.each([
    ["empty", ""],
    ["not base64url", "abc$%^"],
    ["garbage", "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo"],
    ["too long", "A".repeat(MAX_TOKEN_CHARS + 1)],
    ["wrong version", tokenOf({ v: 2, s: {}, e: {} })],
    ["not an object", tokenOf("hello")],
  ])("rejects %s", (_name, token) => {
    expect(decodeShare(token as string)).toBeNull();
  });

  it("refuses a decompression bomb", () => {
    const bomb = tokenOf({ v: 1, s: { pad: "x".repeat(5_000_000) }, e: {} });
    expect(bomb.length).toBeLessThan(MAX_TOKEN_CHARS);
    expect(decodeShare(bomb)).toBeNull();
  });

  it("sanitises hostile values instead of trusting them", () => {
    const token = tokenOf({
      v: 1,
      s: { chats: -1, club: "<script>", by_hour: { "16": "lots" }, night_share: 99 },
      e: { opener: "<img src=x onerror=alert(1)>".repeat(20), tag: "Evil Tag!!", theme: "javascript:" },
    });
    const out = decodeShare(token)!;
    expect(out.stats.chats).toBe(0);
    expect(out.stats.club).toBe("Talkers");
    expect(out.stats.by_hour).toEqual({});
    expect(out.stats.night_share).toBe(0);
    expect(out.edits.opener.length).toBeLessThanOrEqual(140); // rendered as text by React, never as HTML
    expect(out.edits.tag).toBe("evil-tag");
    expect(out.edits.theme).toBe("brand");
  });

  it("reads tokens from links and pairs", () => {
    const token = encodeShare(DEMO_STATS, DEMO_EDITS);
    expect(tokenFromInput(`https://www.barrosbuilds.com/wrapped/s#${token}`)).toBe(token);
    expect(tokenFromInput(` #${token} `)).toBe(token);
    expect(tokenFromInput("hello")).toBeNull();
    expect(splitPair(`#${token}.${token}`)).toEqual([token, token]);
    expect(splitPair("#onlyone")).toBeNull();
  });
});

describe("compare", () => {
  it("picks a winner per stat; fewer retries wins", () => {
    const a = toCardStats({ chats: 10, retries: 2, night_share: 0.2, web_searches: 5 });
    const b = toCardStats({ chats: 4, retries: 9, night_share: 0.2, web_searches: 50 });
    const { duels, scoreA, scoreB } = compare(a, b);
    const by = Object.fromEntries(duels.map((d) => [d.key, d]));
    expect(by.chats.winner).toBe("a");
    expect(by.web.winner).toBe("b");
    expect(by.retries.winner).toBe("a");
    expect(by.night.winner).toBe("tie");
    expect(by.night.a).toBe("20%");
    expect(scoreA).toBe(duels.filter((d) => d.winner === "a").length);
    expect(scoreB).toBe(duels.filter((d) => d.winner === "b").length);
  });
});
