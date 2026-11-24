// "Prove it": who wins each stat between two people.
import { fmt, languagesUsed, percent } from "../story/derive";
import type { CardStats } from "../story/schema";

export interface Duel {
  key: string;
  label: string;
  a: string;
  b: string;
  winner: "a" | "b" | "tie";
}

interface DuelDef {
  key: string;
  label: string;
  value: (s: CardStats) => number;
  show?: (n: number) => string;
  /** Fewer wins (e.g. retries: getting it right first time). */
  lowerWins?: boolean;
}

export const DUELS: DuelDef[] = [
  { key: "chats", label: "Chats started", value: (s) => s.chats },
  { key: "messages", label: "Messages sent", value: (s) => s.your_messages },
  { key: "active_days", label: "Active days", value: (s) => s.active_days },
  { key: "streak", label: "Longest streak (days)", value: (s) => s.longest_streak_days },
  { key: "web", label: "Web searches", value: (s) => s.web_searches },
  { key: "code", label: "Code runs", value: (s) => s.code_runs },
  { key: "built", label: "Files & artifacts made", value: (s) => s.files_created + s.artifacts },
  { key: "tokens", label: "Tokens (estimated)", value: (s) => s.est_tokens_visible },
  { key: "languages", label: "Languages", value: (s) => languagesUsed(s) },
  { key: "night", label: "After 10pm", value: (s) => s.night_share, show: (n) => `${percent(n)}%` },
  { key: "thanks", label: "Thank-yous", value: (s) => s.thanks },
  { key: "retries", label: "Retries (fewer wins)", value: (s) => s.retries, lowerWins: true },
];

export function compare(a: CardStats, b: CardStats): { duels: Duel[]; scoreA: number; scoreB: number } {
  let scoreA = 0;
  let scoreB = 0;
  const duels = DUELS.map((d) => {
    const va = d.value(a);
    const vb = d.value(b);
    const show = d.show ?? fmt;
    let winner: Duel["winner"] = "tie";
    if (va !== vb) winner = (va > vb) !== Boolean(d.lowerWins) ? "a" : "b";
    if (winner === "a") scoreA++;
    if (winner === "b") scoreB++;
    return { key: d.key, label: d.label, a: show(va), b: show(vb), winner };
  });
  return { duels, scoreA, scoreB };
}
