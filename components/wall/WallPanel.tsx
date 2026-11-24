"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { cleanTag, type StoryEdits } from "@/lib/story/edits";
import type { CardStats } from "@/lib/story/schema";
import { DISTRIBUTION, WALL_DATA } from "@/lib/wall/data";
import { buildEntry, cleanName, entryFileName, githubNewFileUrl, isEligible, NAME_RE, randomSuffix } from "@/lib/wall/entry";
import { rankLines } from "@/lib/wall/rank";

interface Props {
  stats: CardStats;
  edits: StoryEdits;
  /** False for the demo: you can only add your own stats. */
  canJoin: boolean;
}

export function WallPanel({ stats, edits, canJoin }: Props) {
  const [name, setName] = useState(edits.display_name);
  const [tag, setTag] = useState(edits.tag);
  const [consent, setConsent] = useState(false);
  const [suffix] = useState(randomSuffix);
  const ranks = useMemo(() => rankLines(stats, DISTRIBUTION), [stats]);
  const eligible = isEligible(stats);

  const cleanedName = cleanName(name);
  const nameOk = NAME_RE.test(cleanedName);
  const entry = buildEntry(stats, cleanedName, tag);
  const url = githubNewFileUrl(entry, entryFileName(cleanedName, suffix));
  const ready = canJoin && eligible && nameOk && consent;
  const needed = DISTRIBUTION.min_entries - DISTRIBUTION.count;

  return (
    <div data-testid="wall-panel" className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-bold">How you rank</h3>
        {!DISTRIBUTION.metrics ? (
          <p className="text-sm text-cream/80" data-testid="ranks-locked">
            Ranks unlock when {DISTRIBUTION.min_entries} people have joined the Wall ({Math.max(0, needed)} to go).
          </p>
        ) : ranks.length ? (
          <ul className="flex flex-col gap-1" data-testid="rank-lines">
            {ranks.map((r) => (
              <li key={r.metric} className="font-display text-xl font-bold">
                Top <span className="text-amber">{r.top}%</span> for {r.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-cream/80">Not in anyone&apos;s top quarter yet. There&apos;s always 2027.</p>
        )}
        <p className="text-xs text-muted">
          Worked out in your browser against the Wall&apos;s {WALL_DATA.count} entries. Your numbers aren&apos;t sent
          anywhere.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Join the Wall</h3>
        {!canJoin ? (
          <p className="text-sm text-cream/80">Make your own story to join the Wall.</p>
        ) : !eligible ? (
          <p className="text-sm text-cream/80" data-testid="wall-not-eligible">
            The Wall only takes exact numbers (export, full prompt kit or CLI), not estimates.
          </p>
        ) : (
          <>
            <p className="text-sm text-cream/80">
              The Wall is a public file on GitHub, one per person. You&apos;ll open the pull request yourself, so you
              need a GitHub account. Only the numbers below plus your name and tag are published: no titles, no
              words, no opener.
            </p>
            <label className="flex flex-col gap-1 font-mono text-sm text-muted">
              Name on the Wall
              <input
                value={name}
                maxLength={32}
                onChange={(e) => setName(e.target.value)}
                data-testid="wall-name"
                aria-invalid={name !== "" && !nameOk}
                className="rounded-lg border border-line bg-ink px-3 py-2 font-sans text-cream"
              />
            </label>
            {name !== "" && !nameOk && <p className="text-sm text-coral">Letters, numbers, spaces and . &apos; - only.</p>}
            <label className="flex flex-col gap-1 font-mono text-sm text-muted">
              Group tag (optional): your team, company or city
              <span className="flex items-center gap-1">
                <span className="text-amber">#</span>
                <input
                  value={tag}
                  onChange={(e) => setTag(cleanTag(e.target.value, { typing: true }))}
                  data-testid="wall-tag"
                  className="w-full rounded-lg border border-line bg-ink px-3 py-2 font-sans text-cream"
                />
              </span>
            </label>
            <details className="rounded-xl border border-line">
              <summary className="cursor-pointer px-4 py-2 font-mono text-sm text-amber">
                See exactly what gets published
              </summary>
              <pre data-testid="wall-preview" className="max-h-72 overflow-auto px-4 pb-4 font-mono text-xs text-cream/85">
                {JSON.stringify(entry, null, 2)}
              </pre>
            </details>
            <label className="flex items-start gap-2 text-sm text-cream/85">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                data-testid="wall-consent"
                className="mt-1"
              />
              I understand this becomes public on GitHub, and that git keeps old versions even after I remove it.
            </label>
            <a
              href={ready ? url : undefined}
              aria-disabled={!ready}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="wall-open-pr"
              className={`self-start rounded-full px-5 py-2 font-mono text-sm font-medium no-underline ${
                ready ? "bg-amber text-ink hover:bg-amber-hi hover:text-ink" : "pointer-events-none bg-line text-muted"
              }`}
            >
              Open the pull request on GitHub →
            </a>
            <p className="text-xs text-muted">
              GitHub copies the project to your account and opens the pull request. Once it&apos;s reviewed and merged,
              you&apos;re on the Wall. To leave, delete your file in a pull request or open an issue.
            </p>
          </>
        )}
        <Link href="/wall" className="font-mono text-sm">
          See the Wall →
        </Link>
      </section>
    </div>
  );
}
