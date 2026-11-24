// Splits the engine's full output into what may be shared and what stays on this device.
// Sharing uses an allow-list: a new metric is local-only until it is added here on purpose.
import { YEAR } from "./render";

export type FullStats = Record<string, unknown>;

export const SHAREABLE_METRICS = [
  "chats",
  "your_messages",
  "claude_messages",
  "files_uploaded",
  "one_shot_chats",
  "active_days",
  "longest_streak_days",
  "by_month",
  "by_hour",
  "by_weekday",
  "avg_messages_per_active_day",
  "night_share",
  "weekend_share",
  "chattiest_day",
  "est_tokens_visible",
  "your_words",
  "claude_words",
  "thinking_blocks",
  "thanks",
  "em_dashes_from_claude",
  "retries",
  "tool_calls",
  "web_searches",
  "code_runs",
  "files_created",
  "memory_lookups",
  "agent_style_chats",
  "top_tools",
  "languages_first_msg",
  "design_chats",
  "design_chats_with_msgs",
  "design_projects",
  "projects_total",
  `projects_created_${YEAR}`,
  "artifacts",
  "scheduled_runs",
  "club",
  "club_scores",
] as const;

export interface LocalOnly {
  chat_titles: string[];
  your_top_words: string[];
  longest_chat_title: string | null;
}

export interface SplitStats {
  /** Safe to show on cards and put in share links (after user review). */
  shareable: Record<string, unknown> & { longest_chat_messages: number | null };
  /** Never leaves this device. */
  local: LocalOnly;
}

export function splitStats(full: FullStats): SplitStats {
  const shareable: Record<string, unknown> = {};
  for (const key of SHAREABLE_METRICS) {
    if (key in full) shareable[key] = full[key];
  }
  const longest = Array.isArray(full.longest_chat) ? full.longest_chat : null;
  return {
    shareable: {
      ...shareable,
      longest_chat_messages: typeof longest?.[0] === "number" ? longest[0] : null,
    },
    local: {
      chat_titles: Array.isArray(full.chat_titles) ? (full.chat_titles as string[]) : [],
      your_top_words: Array.isArray(full.your_top_words) ? (full.your_top_words as string[]) : [],
      longest_chat_title: typeof longest?.[1] === "string" ? longest[1] : null,
    },
  };
}
