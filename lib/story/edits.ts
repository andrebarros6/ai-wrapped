// What the user can change before sharing. Everything is trimmed and length-capped, because these
// strings end up on public images and, later, in share links.
import { defaultOpener, defaultPrediction } from "./derive";
import type { CardStats } from "./schema";
import type { ThemeName } from "./theme";

export interface StoryEdits {
  display_name: string;
  tag: string; // without "#"
  opener: string;
  prediction: [string, string, string];
  chattiest_day_example: string;
  theme: ThemeName;
}

export const LIMITS = { display_name: 32, tag: 24, opener: 140, prediction: 60, chattiest_day_example: 90 } as const;

const clean = (s: unknown, max: number): string =>
  typeof s === "string"
    ? s
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/**
 * "#Lisbon Builders!" → "lisbon-builders". With `typing`, a trailing "-" is kept so a separator
 * can be typed ("lisbon " → "lisbon-" → "lisbon-builders"); displays and saves use the full clean.
 */
export function cleanTag(raw: unknown, { typing = false }: { typing?: boolean } = {}): string {
  if (typeof raw !== "string") return "";
  const tag = raw
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .slice(0, LIMITS.tag);
  return typing ? tag : tag.replace(/-$/, "");
}

export function defaultEdits(s: CardStats): StoryEdits {
  return {
    display_name: "",
    tag: "",
    opener: defaultOpener(s),
    prediction: defaultPrediction(s),
    chattiest_day_example: "",
    theme: "brand",
  };
}

/** Merge untrusted edits over the defaults, sanitising every field. */
export function sanitizeEdits(raw: unknown, s: CardStats): StoryEdits {
  const base = defaultEdits(s);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const pred = Array.isArray(r.prediction) ? r.prediction : [];
  return {
    display_name: clean(r.display_name, LIMITS.display_name),
    tag: cleanTag(r.tag),
    opener: clean(r.opener, LIMITS.opener) || base.opener,
    prediction: [0, 1, 2].map((i) => clean(pred[i], LIMITS.prediction) || base.prediction[i]) as [
      string,
      string,
      string,
    ],
    chattiest_day_example: clean(r.chattiest_day_example, LIMITS.chattiest_day_example),
    theme: r.theme === "dark" ? "dark" : "brand",
  };
}

const EDITS_KEY = "ai-wrapped:edits";

export function loadEdits(s: CardStats): StoryEdits {
  try {
    return sanitizeEdits(JSON.parse(sessionStorage.getItem(EDITS_KEY) ?? "null"), s);
  } catch {
    return defaultEdits(s);
  }
}

export function saveEdits(e: StoryEdits): void {
  try {
    sessionStorage.setItem(EDITS_KEY, JSON.stringify(e));
  } catch {
    // storage full or blocked: edits just won't survive a reload
  }
}
