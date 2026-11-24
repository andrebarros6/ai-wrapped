// Radial chart of messages by hour, ported from design/story-brand/06-ai-clock.dc.html:
// 24 wedges clockwise from midnight at the top, length ∝ messages, night hours dimmed, peak highlighted.
import { hourLabel, peakHour } from "@/lib/story/derive";
import type { CardTheme } from "@/lib/story/theme";

const C = 440; // centre of the 880×880 viewBox
const INNER = 150;
const MAX_LEN = 260;
const MIN_LEN = 6;

const point = (r: number, deg: number): string => {
  const a = (deg * Math.PI) / 180;
  return `${(C + r * Math.sin(a)).toFixed(1)} ${(C - r * Math.cos(a)).toFixed(1)}`;
};

function wedge(hour: number, outer: number): string {
  const a0 = hour * 15 + 2;
  const a1 = hour * 15 + 13;
  return [
    `M${point(INNER, a0)}`,
    `L${point(outer, a0)}`,
    `A${outer.toFixed(1)} ${outer.toFixed(1)} 0 0 1 ${point(outer, a1)}`,
    `L${point(INNER, a1)}`,
    `A${INNER} ${INNER} 0 0 0 ${point(INNER, a0)}`,
    "Z",
  ].join(" ");
}

export const isNightHour = (h: number): boolean => h >= 22 || h < 5;

export function AiClock({ byHour, t, size = 760 }: { byHour: Record<string, number>; t: CardTheme; size?: number }) {
  const counts = Array.from({ length: 24 }, (_, h) => byHour[String(h)] ?? 0);
  const max = Math.max(1, ...counts);
  const peak = peakHour(byHour);
  const label = peak
    ? `Messages by hour of day, peaking at ${hourLabel(peak.hour)} with ${peak.count} messages`
    : "Messages by hour of day: no messages yet";

  return (
    <svg width={size} height={size} viewBox="0 0 880 880" role="img" aria-label={label} style={{ alignSelf: "center" }}>
      {counts.map((c, h) => {
        const len = c === 0 ? 3 : Math.max(MIN_LEN, (c / max) * MAX_LEN);
        const fill = peak?.hour === h ? t.clock.peak : isNightHour(h) ? t.clock.night : t.clock.base;
        return <path key={h} d={wedge(h, INNER + len)} fill={fill} opacity={c === 0 ? 0.35 : 1} />;
      })}
      {/* Midnight on top, noon at the bottom. Side labels would collide with wide peak labels ("11am"). */}
      {(
        [
          ["00", C - 124 + 18],
          ["12", C + 124],
        ] as const
      ).map(([text, y]) => (
        <text key={text} x={C} y={y} textAnchor="middle" fontSize={26} fill={t.muted} style={{ fontFamily: t.mono }}>
          {text}
        </text>
      ))}
      <text x={C} y={436} textAnchor="middle" fontSize={78} fontWeight={800} fill={t.fg} style={{ fontFamily: t.display }}>
        {peak ? hourLabel(peak.hour) : "–"}
      </text>
      <text x={C} y={476} textAnchor="middle" fontSize={22} fill={t.muted} style={{ fontFamily: t.mono }}>
        {peak ? `PEAK HOUR · ${peak.count}` : "PEAK HOUR"}
      </text>
    </svg>
  );
}
