// The stats the cards read. Every field falls back to a safe default, so cards never crash on
// missing or malformed input (older share links, prompt-kit JSON, hand-edited data).
import { z } from "zod";

export const CLUBS = ["Researchers", "Builders", "Coders", "Night Shift", "Polyglots", "Talkers"] as const;
export type Club = (typeof CLUBS)[number];

/** Where the numbers came from. "lite-prompt" numbers are estimates and the cards say so. */
export const SOURCES = ["claude-export", "full-prompt", "cli", "lite-prompt"] as const;
export type Source = (typeof SOURCES)[number];

const MAX = 1e9;
const count = z.number().finite().min(0).max(MAX).catch(0);
const share = z.number().finite().min(0).max(1).catch(0);
const counts = z.record(z.string().max(32), z.number().finite().min(0).max(MAX)).catch({});

export const CardStatsSchema = z.object({
  source: z.enum(SOURCES).catch("claude-export"),
  chats: count,
  your_messages: count,
  claude_messages: count,
  active_days: count,
  longest_streak_days: count,
  by_month: counts,
  by_hour: counts,
  by_weekday: counts,
  avg_messages_per_active_day: count,
  night_share: share,
  weekend_share: share,
  chattiest_day: z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), messages: count, topics: count })
    .nullable()
    .catch(null),
  est_tokens_visible: count,
  your_words: count,
  claude_words: count,
  thanks: count,
  retries: count,
  em_dashes_from_claude: count,
  tool_calls: count,
  web_searches: count,
  code_runs: count,
  files_created: count,
  languages_first_msg: counts,
  design_chats: count,
  projects_total: count,
  artifacts: count,
  scheduled_runs: count.nullable().catch(null),
  club: z.enum(CLUBS).catch("Talkers"),
  club_scores: counts,
  longest_chat_messages: count.nullable().catch(null),
});

export type CardStats = z.infer<typeof CardStatsSchema>;

export function toCardStats(raw: unknown): CardStats {
  return CardStatsSchema.parse(raw && typeof raw === "object" ? raw : {});
}
