import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WallPerson } from "@/lib/wall/data";

import { Leaderboard } from "./Leaderboard";

const person = (name: string, chats: number, tag = ""): WallPerson => ({
  id: name.toLowerCase(),
  display_name: name,
  tag,
  club: "Builders",
  languages: 1,
  chats,
  night_share: 0.25,
});

describe("Leaderboard", () => {
  it("ranks by chats by default, most first, and links tags", () => {
    const html = renderToStaticMarkup(
      <Leaderboard people={[person("Bea", 10), person("Ana", 300, "acme"), person("Caio", 42)]} />,
    );
    expect(html.indexOf("Ana")).toBeLessThan(html.indexOf("Caio"));
    expect(html.indexOf("Caio")).toBeLessThan(html.indexOf("Bea"));
    expect(html).toContain('href="/wall/acme"');
    expect(html).toContain(">300<");
  });

  it("respects the limit", () => {
    const people = Array.from({ length: 80 }, (_, i) => person(`P${i}`, i));
    const html = renderToStaticMarkup(<Leaderboard people={people} limit={50} />);
    expect(html.match(/data-testid="leaderboard-row"/g)).toHaveLength(50);
  });
});
