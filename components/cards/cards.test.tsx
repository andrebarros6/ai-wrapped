import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FIXTURES, golden, TIMEZONES } from "@/e2e/fixtures";
import { splitStats } from "@/lib/engine/stats";
import { DEMO_EDITS, DEMO_STATS } from "@/lib/story/demo";
import { defaultEdits } from "@/lib/story/edits";
import { toCardStats } from "@/lib/story/schema";
import { THEMES } from "@/lib/story/theme";

import { CARDS, deckFor, StoryCard } from "./cards";

const render = (index: number, s = DEMO_STATS, e = DEMO_EDITS, theme: "brand" | "dark" = "brand") =>
  renderToStaticMarkup(<StoryCard def={CARDS[index]} n={index + 1} total={CARDS.length} s={s} e={e} t={THEMES[theme]} />);

describe("cards", () => {
  it("there are eight, each with SQL behind it", () => {
    expect(CARDS).toHaveLength(8);
    for (const c of CARDS) expect(c.sql.length).toBeGreaterThan(0);
  });

  it.each(CARDS.map((c, i) => [c.key, i]))("%s renders the demo in both themes", (_key, i) => {
    for (const theme of ["brand", "dark"] as const) {
      const html = render(i as number, DEMO_STATS, DEMO_EDITS, theme);
      expect(html).toContain(`${(i as number) + 1} / 8`);
      expect(html).toContain("barrosbuilds.com/wrapped · #barrosbuilds");
    }
  });

  it("shows the demo numbers from the designs", () => {
    expect(render(1)).toContain("1,699");
    expect(render(2)).toContain("1,151");
    expect(render(3)).toContain("25 Feb");
    expect(render(4)).toContain("Researchers Club");
    expect(render(5)).toContain("Afternoon Operator");
    expect(render(5)).toContain("4pm");
    expect(render(6)).toContain(">84<");
    expect(render(7)).toContain("Ship product #11 from Almería.");
  });

  it("omits the tag separator when there is no tag", () => {
    const html = render(0, DEMO_STATS, { ...DEMO_EDITS, tag: "" });
    expect(html).toContain("barrosbuilds.com/wrapped</span>");
  });

  it.each(FIXTURES.flatMap((f) => TIMEZONES.map((tz) => [f, tz])))(
    "%s %s: every card renders and no chat title leaks into a card",
    (fixture, tz) => {
      const full = golden(fixture, tz);
      const stats = toCardStats(splitStats(full).shareable);
      const html = CARDS.map((_, i) => render(i, stats, defaultEdits(stats))).join("\n");
      expect(html).toContain(new Intl.NumberFormat("en").format(stats.chats));
      for (const title of full.chat_titles as string[]) expect(html).not.toContain(title);
    },
  );

  it("lite estimates get a shorter deck, each card marked ESTIMATED", () => {
    const lite = toCardStats({ source: "lite-prompt", chats: 120, your_messages: 900, club: "Builders" });
    const deck = deckFor(lite);
    expect(deck.map((c) => c.key)).toEqual(["opener", "numbers", "work", "club", "prediction"]);
    const html = renderToStaticMarkup(
      <StoryCard def={deck[1]} n={2} total={deck.length} s={lite} e={defaultEdits(lite)} t={THEMES.brand} />,
    );
    expect(html).toContain("AI WRAPPED 2026 · ESTIMATED");
    expect(html).toContain("2 / 5");
    expect(deckFor(DEMO_STATS)).toHaveLength(8);
  });

  it("survives empty stats", () => {
    const empty = toCardStats({});
    for (let i = 0; i < CARDS.length; i++) expect(() => render(i, empty, defaultEdits(empty))).not.toThrow();
    expect(render(3, empty, defaultEdits(empty))).toContain("No chats this year");
  });
});
