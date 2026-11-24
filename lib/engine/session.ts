// Where results live between pages of this tab. Shareable stats go to sessionStorage (this tab
// only, cleared when it closes). Local-only fields (titles, your words) stay in memory only.
import { YEAR } from "./render";
import type { Source } from "../story/schema";
import type { LocalOnly, SplitStats } from "./stats";

export const SESSION_KEY = "ai-wrapped:stats";

export type SessionStats = SplitStats["shareable"] & {
  version: 1;
  source: Source;
  year: number;
  tz: string;
};

let localOnly: LocalOnly | null = null;

export function saveSession(split: SplitStats, tz: string, source: Source = "claude-export"): SessionStats {
  const stats: SessionStats = { version: 1, source, year: YEAR, tz, ...split.shareable };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(stats));
  localOnly = split.local;
  return stats;
}

export function readSession(): SessionStats | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionStats) : null;
  } catch {
    return null;
  }
}

/** Titles and words for opt-in suggestions. Gone after a reload, by design. */
export function readLocalOnly(): LocalOnly | null {
  return localOnly;
}
