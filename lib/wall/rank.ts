// "Top 8% for web searches": computed in the visitor's browser against the Wall's published
// percentiles, so their own stats never leave the device.
import type { CardStats } from "../story/schema";
import { WALL_FIELDS } from "./entry";

export interface Distribution {
  version: number;
  count: number;
  min_entries: number;
  /** For each metric, 101 values: the 0th..100th percentile across the Wall. */
  metrics: Record<string, number[]> | null;
}

export interface RankLine {
  metric: string;
  label: string;
  top: number; // "Top N%"
}

const LABELS: Record<string, string> = { ...WALL_FIELDS.counts, ...WALL_FIELDS.shares };

/** Share of the Wall at or below this value is what matters: "top" = 100 - percentile, min 1. */
export function topPercent(value: number, quantiles: number[]): number {
  if (quantiles.length !== 101) return 100;
  const below = quantiles.filter((q) => q < value).length; // 0..101
  return Math.min(100, Math.max(1, 101 - below));
}

/** Your best ranks (top 25% or better), best first. */
export function rankLines(s: CardStats, d: Distribution, max = 3): RankLine[] {
  if (!d.metrics) return [];
  const lines: RankLine[] = [];
  for (const metric of WALL_FIELDS.rank_metrics) {
    const q = d.metrics[metric];
    const value = s[metric as keyof CardStats];
    if (!q || typeof value !== "number" || value <= 0) continue;
    const top = topPercent(value, q);
    if (top <= 25) lines.push({ metric, label: LABELS[metric] ?? metric, top });
  }
  return lines.sort((a, b) => a.top - b.top).slice(0, max);
}
