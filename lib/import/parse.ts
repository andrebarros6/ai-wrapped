// Turns JSON pasted from the prompt kit (or the CLI) into the same stats the upload produces.
// Everything stays in this browser. Pasted text is untrusted: size-capped, then validated.
import { splitStats, type SplitStats } from "../engine/stats";
import { isValidTimeZone } from "../engine/render";
import type { Source } from "../story/schema";

export const MAX_PASTE_CHARS = 300_000;

export interface Imported {
  split: SplitStats;
  source: Source;
  tz: string;
  /** Text the lite prompt wrote (opener, predictions), offered as starting edits. */
  edits: { opener?: string; prediction?: string[] };
}

export class ImportError extends Error {}

/** Pull the JSON object out of a reply that may include code fences or chatter around it. */
export function extractJson(text: string): unknown {
  if (text.length > MAX_PASTE_CHARS) throw new ImportError("That's too long to be the prompt's reply.");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ImportError("No JSON found. Paste the code block Claude replied with.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ImportError("That JSON is incomplete. Copy the whole code block and try again.");
  }
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const emptyLocal = { chat_titles: [], chattiest_day_titles: [], your_top_words: [], longest_chat_title: null };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * The lite prompt's rough activity profile (24 hourly or 7 daily weights, counts or shares) turned
 * into message counts that add up to `your_messages`, so the clock card reads like the exact one.
 * Anything malformed is dropped, and the card that needs it stays hidden.
 */
function spread(v: unknown, keys: readonly string[], total: number): Record<string, number> | undefined {
  if (!Array.isArray(v) || v.length !== keys.length) return undefined;
  const w = v.map((x) => Math.max(0, num(x) ?? 0));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return undefined;
  const scale = total > 0 ? total / sum : 1;
  return Object.fromEntries(keys.flatMap((k, i) => (w[i] > 0 ? [[k, Math.round(w[i] * scale)]] : [])));
}

function estimatedRhythm(o: Record<string, unknown>) {
  const total = num(o.your_messages) ?? 0;
  const out: Record<string, unknown> = {
    thanks: num(o.thanks),
    retries: num(o.retries),
    by_hour: spread(o.by_hour, Array.from({ length: 24 }, (_, h) => String(h)), total),
    by_weekday: spread(o.by_weekday, WEEKDAYS, total),
  };
  const d = o.chattiest_day as Record<string, unknown> | null | undefined;
  const date = typeof d?.date === "string" ? d.date : "";
  const messages = num(d?.messages) ?? 0;
  if (/^2026-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) && !Number.isNaN(Date.parse(date)) && messages > 0) {
    out.chattiest_day = { date, messages, topics: Math.max(1, num(d?.topics) ?? 1) };
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

/** The card's heading says "In 2027, you will…", so "You'll ship more" becomes "Ship more". */
export function asContinuation(line: string): string {
  const trimmed = line.trim();
  const rest = trimmed.replace(/^(you['’]ll|you will)\s+/i, "");
  return rest === trimmed ? rest : rest.charAt(0).toUpperCase() + rest.slice(1);
}

export function parseImport(text: string): Imported {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ImportError("That isn't the prompt's JSON.");
  const o = raw as Record<string, unknown>;
  const tz = typeof o.tz === "string" && isValidTimeZone(o.tz) ? o.tz : "UTC";

  if (o.source === "lite-prompt") {
    const chats = num(o.chats ?? o.chats_estimate);
    if (chats === undefined) throw new ImportError("The lite JSON needs at least a number of chats.");
    const languages = Math.max(0, Math.min(20, Math.round(num(o.languages) ?? 0)));
    const shareable = {
      chats,
      your_messages: num(o.your_messages),
      active_days: num(o.active_days),
      web_searches: num(o.web_searches),
      projects_total: num(o.projects_total),
      night_share: num(o.night_share ?? o.night_share_estimate),
      club: o.club,
      languages_first_msg: Object.fromEntries(Array.from({ length: languages }, (_, i) => [`lang${i + 1}`, 1])),
      ...estimatedRhythm(o),
    };
    return {
      split: { shareable: { ...shareable, longest_chat_messages: null }, local: emptyLocal },
      source: "lite-prompt",
      tz,
      edits: {
        opener: typeof o.opener === "string" ? o.opener : undefined,
        prediction: Array.isArray(o.prediction)
          ? o.prediction.filter((x): x is string => typeof x === "string").map(asContinuation)
          : undefined,
      },
    };
  }

  // Exact numbers: the full prompt kit's output, or the CLI's (which also has local-only fields).
  if (num(o.chats) === undefined || typeof o.by_hour !== "object" || o.by_hour === null) {
    throw new ImportError("That isn't the prompt's JSON. Use full.md or lite.md and paste the reply.");
  }
  const split = splitStats(o);
  if (split.shareable.longest_chat_messages === null) {
    split.shareable.longest_chat_messages = num(o.longest_chat_messages) ?? null;
  }
  return { split, source: o.source === "full-prompt" ? "full-prompt" : "cli", tz, edits: {} };
}
