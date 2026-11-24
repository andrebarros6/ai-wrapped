// Turns stats into the words on the cards. Pure functions, unit-tested.
import { CLUBS, type Club } from "./constants";
import type { CardStats } from "./schema";

const nf = new Intl.NumberFormat("en");
export const fmt = (n: number): string => nf.format(Math.round(n));
export const plural = (n: number, one: string, many: string): string => (Math.round(n) === 1 ? one : many);

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 0 → "12am", 15 → "3pm". */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const twelve = hh % 12 === 0 ? 12 : hh % 12;
  return `${twelve}${hh < 12 ? "am" : "pm"}`;
}

/** Hour with most messages (ties: earliest). */
export function peakHour(byHour: Record<string, number>): { hour: number; count: number } | null {
  let best: { hour: number; count: number } | null = null;
  for (let h = 0; h < 24; h++) {
    const c = byHour[String(h)] ?? 0;
    if (c > 0 && (!best || c > best.count)) best = { hour: h, count: c };
  }
  return best;
}

export function clockArchetype(hour: number | null): { article: "a" | "an"; name: string } {
  if (hour === null) return { article: "a", name: "Mystery Clock" };
  if (hour >= 5 && hour < 9) return { article: "an", name: "Early Bird" };
  if (hour >= 9 && hour < 12) return { article: "a", name: "Morning Mover" };
  if (hour >= 12 && hour < 18) return { article: "an", name: "Afternoon Operator" };
  if (hour >= 18 && hour < 22) return { article: "an", name: "Evening Builder" };
  return { article: "a", name: "Night Owl" };
}

/** Weekday with most messages (ties: earlier in the week). */
export function busiestWeekday(byWeekday: Record<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  for (const d of WEEKDAYS) {
    const n = byWeekday[d] ?? 0;
    if (n > bestN) [best, bestN] = [d, n];
  }
  return best;
}

/** The earliest hour of the day (from 4am) holding at least 2% of messages: when your day starts. */
export function earliestHabit(byHour: Record<string, number>): number | null {
  const total = Object.values(byHour).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const threshold = Math.max(1, total * 0.02);
  for (let i = 0; i < 24; i++) {
    const h = (4 + i) % 24;
    if ((byHour[String(h)] ?? 0) >= threshold) return h;
  }
  return null;
}

export const percent = (share: number): number => Math.round(share * 100);

/** "2026-02-25" → "25 Feb". */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1] ?? ""}`.trim();
}

/** 7.5 → "7.5", 7 → "7". */
export const decimal = (n: number): string => (Number.isInteger(n) ? fmt(n) : n.toFixed(1));

export function languagesUsed(s: CardStats): number {
  return Object.values(s.languages_first_msg).filter((n) => n > 0).length;
}

export interface Tile {
  value: number;
  label: string;
}

/** Up to six "how you work" tiles: chats first, then whatever this person actually used. */
export function workTiles(s: CardStats): Tile[] {
  const candidates: Tile[] = [
    { value: s.projects_total, label: plural(s.projects_total, "project", "projects") },
    { value: s.design_chats, label: plural(s.design_chats, "design chat", "design chats") },
    { value: s.artifacts, label: plural(s.artifacts, "artifact made", "artifacts made") },
    { value: s.scheduled_runs ?? 0, label: plural(s.scheduled_runs ?? 0, "scheduled run", "scheduled runs") },
    { value: s.web_searches, label: plural(s.web_searches, "web search", "web searches") },
    { value: s.code_runs, label: plural(s.code_runs, "code run", "code runs") },
    { value: s.files_created, label: plural(s.files_created, "file created", "files created") },
    { value: s.thanks, label: plural(s.thanks, "thank-you", "thank-yous") },
  ];
  const tiles = [{ value: s.chats, label: plural(s.chats, "chat", "chats") }];
  for (const t of candidates) if (t.value > 0 && tiles.length < 6) tiles.push(t);
  return tiles;
}

export function workHeadline(s: CardStats): [string, string] {
  const built = s.projects_total + s.design_chats + s.artifacts + (s.scheduled_runs ?? 0) + s.files_created;
  if (built >= 10) return ["You don't just chat.", "You build."];
  if (s.web_searches >= s.chats && s.web_searches > 0) return ["You don't just chat.", "You dig."];
  if (s.code_runs > 0) return ["You don't just chat.", "You run things."];
  return ["Every chat counts.", "Here's yours."];
}

export const CLUB_RULES: Record<Club, string> = {
  Researchers: "most web searches",
  Builders: "most files & artifacts",
  Coders: "most code runs",
  "Night Shift": "most messages after 10pm",
  Polyglots: "3+ languages",
  Talkers: "longest chats",
};

const ROLES: Record<Club, string> = {
  Researchers: "Fact-Checker",
  Builders: "Maker",
  Coders: "Debugger",
  "Night Shift": "Night Owl",
  Polyglots: "Border-Hopper",
  Talkers: "Storyteller",
};

/** Your club's headline number, and a role from your second-strongest club. */
export function clubLine(s: CardStats): string {
  const perChat = s.chats > 0 ? s.your_messages / s.chats : 0;
  const hero: Record<Club, string> = {
    Researchers: `${fmt(s.web_searches)} ${plural(s.web_searches, "web search", "web searches")}.`,
    Builders: `${fmt(s.files_created + s.artifacts)} files and artifacts.`,
    Coders: `${fmt(s.code_runs)} ${plural(s.code_runs, "code run", "code runs")}.`,
    "Night Shift": `${percent(s.night_share)}% of your messages after 10pm.`,
    Polyglots: `${languagesUsed(s)} languages.`,
    Talkers: `${decimal(Math.round(perChat * 10) / 10)} messages per chat.`,
  };
  const second = CLUBS.filter((c) => c !== s.club).sort(
    (a, b) => (s.club_scores[b] ?? 0) - (s.club_scores[a] ?? 0) || CLUBS.indexOf(a) - CLUBS.indexOf(b),
  )[0];
  const role =
    second && (s.club_scores[second] ?? 0) > 0
      ? ` Your role: the ${ROLES[second]}${second === "Polyglots" ? `, in ${languagesUsed(s)} languages` : ""}.`
      : "";
  return hero[s.club] + role;
}

export function tryAgainVerdict(retries: number, thanks: number): string {
  if (retries === 0 && thanks === 0) return "Efficient. No retries, no small talk.";
  if (thanks >= retries * 1.5) return "Unfailingly polite.";
  if (thanks >= retries * 0.3) return "Somewhere between demanding and polite.";
  return "Demanding. Claude can take it.";
}

export function defaultOpener(s: CardStats): string {
  if (s.chats === 0) return "A quiet year with Claude. Next year starts now.";
  return `${fmt(s.chats)} ${plural(s.chats, "chat", "chats")} over ${fmt(s.active_days)} ${plural(
    s.active_days,
    "day",
    "days",
  )}, with a ${fmt(s.longest_streak_days)}-day streak along the way.`;
}

export function defaultPrediction(s: CardStats): [string, string, string] {
  const peak = peakHour(s.by_hour);
  const third: Record<Club, string> = {
    Researchers: `Beat ${fmt(s.web_searches)} web searches.`,
    Builders: `Ship more than ${fmt(s.files_created + s.artifacts)} files.`,
    Coders: `Run more than ${fmt(s.code_runs)} commands.`,
    "Night Shift": `Go to bed before ${peak ? hourLabel(peak.hour) : "midnight"}. Maybe.`,
    Polyglots: `Add language number ${languagesUsed(s) + 1}.`,
    Talkers: "Keep chats short. You won't.",
  };
  return [
    `Start chat #${fmt(s.chats + 1)} in January.`,
    s.thanks > s.retries
      ? `Say thanks more than ${fmt(s.thanks)} times.`
      : `Finally say thanks more than ${fmt(s.thanks)} times.`,
    third[s.club],
  ];
}
