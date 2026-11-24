"use client";

import Link from "next/link";
import { useState } from "react";

import type { WallPerson } from "@/lib/wall/data";
import { WALL_FIELDS } from "@/lib/wall/entry";

const LABELS: Record<string, string> = { ...WALL_FIELDS.counts, ...WALL_FIELDS.shares };
const nf = new Intl.NumberFormat("en");
const show = (metric: string, v: number) => (metric.endsWith("_share") ? `${Math.round(v * 100)}%` : nf.format(v));

export function Leaderboard({ people, limit = 50 }: { people: WallPerson[]; limit?: number }) {
  const [metric, setMetric] = useState<string>("chats");
  const ranked = [...people]
    .sort((a, b) => Number(b[metric]) - Number(a[metric]) || a.display_name.localeCompare(b.display_name))
    .slice(0, limit);

  return (
    <div className="flex flex-col gap-4" data-testid="leaderboard">
      <label className="flex items-center gap-3 font-mono text-sm text-muted">
        Ranked by
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          data-testid="leaderboard-metric"
          className="rounded-lg border border-line bg-panel px-3 py-2 text-cream"
        >
          {WALL_FIELDS.rank_metrics.map((m) => (
            <option key={m} value={m}>
              {LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <ol className="flex flex-col">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            data-testid="leaderboard-row"
            className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 border-t border-line py-3"
          >
            <span className="font-mono text-muted">{i + 1}</span>
            <span>
              <span className="font-display font-bold">{p.display_name}</span>
              {p.tag && (
                <Link href={`/wall/${p.tag}`} className="ml-2 font-mono text-sm">
                  #{p.tag}
                </Link>
              )}
              <span className="ml-2 font-mono text-xs text-muted">{p.club}</span>
            </span>
            <span className="font-display text-xl font-extrabold text-amber tabular-nums">
              {show(metric, Number(p[metric]))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
