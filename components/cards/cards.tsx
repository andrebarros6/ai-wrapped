// The eight story cards, rebuilt from design/story-brand and design/story-dark.
import type { CSSProperties, ReactNode } from "react";

import {
  busiestWeekday,
  CLUB_RULES,
  clockArchetype,
  clubLine,
  dayLabel,
  decimal,
  earliestHabit,
  fmt,
  hourLabel,
  peakHour,
  percent,
  plural,
  tryAgainVerdict,
  workHeadline,
  workTiles,
} from "@/lib/story/derive";
import { cleanTag, type StoryEdits } from "@/lib/story/edits";
import { CLUBS, type CardStats } from "@/lib/story/schema";
import type { CardTheme } from "@/lib/story/theme";

import { AiClock } from "./AiClock";
import { CardFrame, type ProgressAnimation } from "./CardFrame";

export interface CardProps {
  s: CardStats;
  e: StoryEdits;
  t: CardTheme;
  progress?: ProgressAnimation | null;
}

export interface CardDef {
  key: string;
  label: string;
  cta: string;
  /** sql/metrics files behind this card's numbers ("show the query"). */
  sql: string[];
  variant?: "default" | "club";
  /** Hide the card when the stats can't fill it (e.g. lite-prompt estimates). Default: always shown. */
  available?: (s: CardStats) => boolean;
  Body: (p: CardProps) => ReactNode;
}

const mono = (t: CardTheme, size: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: t.mono,
  fontSize: size,
  ...extra,
});

/** Shrink long hero text so it stays inside the card. */
/** Very long words (e.g. from a crafted link) wrap letter by letter: give them a smaller size. */
const longestWord = (text: string): number => Math.max(0, ...text.split(/\s+/).map((w) => w.length));

const fit = (text: string, base: number, steps: [number, number][]): number => {
  for (const [len, size] of steps) if (text.length > len) return size;
  return base;
};

export const CARDS: CardDef[] = [
  {
    key: "opener",
    label: "Your year",
    cta: "Ready for your year?",
    sql: ["10_volume.sql", "20_time.sql"],
    Body: ({ e, t }) => (
      <>
        <span style={mono(t, 26, { color: t.accent })}>
          {e.display_name ? `${e.display_name.toUpperCase()}'S 2026 IN ONE SENTENCE` : "YOUR 2026 IN ONE SENTENCE"}
        </span>
        <span
          style={{
            fontSize: longestWord(e.opener) > 15 ? 48 : fit(e.opener, 72, [[110, 60]]),
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {e.opener}
        </span>
      </>
    ),
  },
  {
    key: "numbers",
    label: "The numbers",
    cta: "How many did you send?",
    sql: ["10_volume.sql"],
    Body: ({ s, t }) => (
      <>
        {[
          [s.chats, plural(s.chats, "chat started", "chats started")],
          [s.your_messages, plural(s.your_messages, "message sent", "messages sent")],
        ].map(([value, label]) => (
          <div key={label as string} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: fit(fmt(value as number), 129, [[9, 104]]), fontWeight: 800, lineHeight: 0.95 }}>
              {fmt(value as number)}
            </span>
            <span style={mono(t, 30, { opacity: 0.8 })}>{label}</span>
          </div>
        ))}
      </>
    ),
  },
  {
    key: "work",
    label: "How you work",
    cta: "How do you use Claude?",
    sql: ["10_volume.sql", "40_tools.sql", "70_surfaces.sql"],
    Body: ({ s, t }) => {
      const [a, b] = workHeadline(s);
      return (
        <>
          <span style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>
            {a}
            <br />
            {b}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {workTiles(s).map((tile) => (
              <div
                key={tile.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "28px 32px",
                  border: `2px solid ${t.line}`,
                  borderRadius: 20,
                }}
              >
                <span
                  style={{ fontSize: fit(fmt(tile.value), 83, [[6, 66]]), fontWeight: 800, lineHeight: 1, color: t.accent }}
                >
                  {fmt(tile.value)}
                </span>
                <span style={mono(t, 26)}>{tile.label}</span>
              </div>
            ))}
          </div>
        </>
      );
    },
  },
  {
    key: "chattiest",
    label: "Chattiest day",
    cta: "What was your busiest day?",
    sql: ["20_time.sql"],
    available: (s) => s.chattiest_day !== null,
    Body: ({ s, e, t }) => {
      const d = s.chattiest_day;
      if (!d) return <span style={{ fontSize: 72, fontWeight: 800 }}>No chats this year. Yet.</span>;
      return (
        <>
          <span style={mono(t, 28, { color: t.accent })}>YOUR CHATTIEST DAY</span>
          <span style={{ fontSize: 189, fontWeight: 800, lineHeight: 0.85 }}>{dayLabel(d.date)}</span>
          <span style={{ fontSize: 55, fontWeight: 800, lineHeight: 1.1 }}>
            {fmt(d.messages)} {plural(d.messages, "message", "messages")}. {fmt(d.topics)}{" "}
            {plural(d.topics, "topic", "topics")}. One day.
          </span>
          {e.chattiest_day_example && (
            <span style={{ fontSize: 34, lineHeight: 1.3, opacity: 0.85 }}>{e.chattiest_day_example}</span>
          )}
          <span style={mono(t, 26, { opacity: 0.7 })}>
            An average day: {decimal(s.avg_messages_per_active_day)}{" "}
            {plural(s.avg_messages_per_active_day, "message", "messages")}.
          </span>
        </>
      );
    },
  },
  {
    key: "club",
    label: "Your AI club",
    cta: "Which club is your team in?",
    sql: ["90_club.sql", "40_tools.sql", "50_language.sql"],
    variant: "club",
    Body: ({ s, t }) => (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={mono(t, 26)}>YOU&apos;RE IN THE</span>
          {/* "Researchers" is the longest word; at 103px it overflows in the wide brand font. */}
          <span style={{ fontSize: t.name === "brand" ? 88 : 103, fontWeight: 800, lineHeight: 0.95 }}>
            {s.club} Club
          </span>
          <span style={{ fontSize: 34, fontWeight: 500 }}>{clubLine(s)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CLUBS.map((c) => {
            const mine = c === s.club;
            return (
              <div
                key={c}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 24px",
                  borderRadius: 14,
                  ...(mine
                    ? { background: t.club.fg, color: t.club.bg, border: `2px solid ${t.club.fg}` }
                    : { border: `2px solid ${t.club.pillBorder}` }),
                }}
              >
                <span style={{ fontSize: 34, fontWeight: 800 }}>{c}</span>
                <span style={mono(t, 22)}>{CLUB_RULES[c]}</span>
              </div>
            );
          })}
        </div>
      </>
    ),
  },
  {
    key: "clock",
    label: "Your AI clock",
    cta: "When does your team talk to AI?",
    sql: ["20_time.sql"],
    available: (s) => Object.values(s.by_hour).some((n) => n > 0),
    Body: ({ s, t }) => {
      const peak = peakHour(s.by_hour);
      const arch = clockArchetype(peak?.hour ?? null);
      const day = busiestWeekday(s.by_weekday);
      const early = earliestHabit(s.by_hour);
      const b = (x: string) => <b style={{ color: t.fg }}>{x}</b>;
      return (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={mono(t, 26, { color: t.accent })}>YOU&apos;RE {arch.article.toUpperCase()}</span>
            <span style={{ fontSize: 83, fontWeight: 800, lineHeight: 0.95 }}>{arch.name}</span>
            <span style={{ fontSize: 30, opacity: 0.8 }}>
              {fmt(s.your_messages)} {plural(s.your_messages, "message", "messages")}, by the hour you sent them
            </span>
          </div>
          <AiClock byHour={s.by_hour} t={t} />
          <div style={mono(t, 26, { display: "flex", justifyContent: "space-between", color: t.soft })}>
            <span>{b(day ?? "–")} busiest day</span>
            <span>{b(`${percent(s.night_share)}%`)} after 10pm</span>
            <span>
              {b(early === null ? "–" : hourLabel(early))} earliest habit
            </span>
          </div>
        </>
      );
    },
  },
  {
    key: "try-again",
    label: "Try again",
    cta: "Are you nicer to your AI?",
    sql: ["30_text.sql"],
    available: (s) => s.source !== "lite-prompt",
    Body: ({ s, t }) => (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 189, fontWeight: 800, lineHeight: 0.85, color: t.accent }}>{fmt(s.retries)}</span>
          <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1 }}>
            {plural(s.retries, "time", "times")} you made Claude try again
          </span>
        </div>
        <div style={{ height: 2, background: t.line }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 189, fontWeight: 800, lineHeight: 0.85, color: t.fg }}>{fmt(s.thanks)}</span>
          <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1 }}>
            {plural(s.thanks, "time", "times")} you said thanks
          </span>
        </div>
        <span style={mono(t, 28, { opacity: 0.8 })}>{tryAgainVerdict(s.retries, s.thanks)}</span>
      </>
    ),
  },
  {
    key: "prediction",
    label: "2027 prediction",
    cta: "Come back next December to check.",
    sql: ["10_volume.sql", "30_text.sql", "90_club.sql"],
    Body: ({ e, t }) => (
      <>
        <span style={mono(t, 30, { color: t.accent })}>IN 2027, YOU WILL…</span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            fontSize: e.prediction.some((l) => longestWord(l) > 15) ? 40 : 52,
            fontWeight: 800,
            lineHeight: 1.1,
          }}
        >
          {e.prediction.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      </>
    ),
  },
];

/** The cards this person's stats can fill, in order. */
export function deckFor(s: CardStats): CardDef[] {
  return CARDS.filter((c) => c.available?.(s) ?? true);
}

/** Render one card of a deck as a full 1080×1350 frame. `n` is 1-based. */
export function StoryCard({ def, n, total, ...p }: CardProps & { def: CardDef; n: number; total: number }) {
  const { Body } = def;
  return (
    <CardFrame
      n={n}
      total={total}
      estimated={p.s.source === "lite-prompt"}
      label={def.label}
      cta={def.cta}
      tag={cleanTag(p.e.tag)}
      t={p.t}
      variant={def.variant}
      progress={p.progress}
    >
      <Body {...p} />
    </CardFrame>
  );
}
