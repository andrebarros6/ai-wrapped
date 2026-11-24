// André's real 2026 numbers (aggregates only, titles removed), as used in the card designs.
// Shown at /story#demo so anyone can see the cards before exporting their own data.
import { splitStats } from "../engine/stats";
import raw from "./demo-stats.json";
import type { StoryEdits } from "./edits";
import { toCardStats } from "./schema";

export const DEMO_STATS = toCardStats(splitStats(raw as Record<string, unknown>).shareable);

export const DEMO_EDITS: StoryEdits = {
  display_name: "André",
  tag: "barrosbuilds",
  opener: "Three countries, four languages, a mountain of paperwork, and ten things shipped in public.",
  prediction: [
    "Ship product #11 from Almería.",
    "Ask about Spanish paperwork in Spanish.",
    "Finally say thanks more than 30 times.",
  ],
  chattiest_day_example: "From go-to-market strategy to an Instax photo licence.",
  theme: "brand",
};
