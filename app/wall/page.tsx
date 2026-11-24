import type { Metadata } from "next";
import Link from "next/link";

import { Leaderboard } from "@/components/wall/Leaderboard";
import { REPO_URL } from "@/lib/site";
import { WALL_DATA } from "@/lib/wall/data";

export const metadata: Metadata = { title: "The Wall · AI Wrapped 2026" };

const nf = new Intl.NumberFormat("en");

export default function WallPage() {
  const w = WALL_DATA;
  const clubs = Object.entries(w.clubs).sort((a, b) => b[1] - a[1]);
  const biggest = Math.max(1, ...clubs.map(([, n]) => n));
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-14">
      <header className="flex flex-col gap-4">
        <Link href="/" className="font-mono text-sm tracking-[0.25em] text-amber no-underline">
          AI WRAPPED 2026 · THE WALL
        </Link>
        <h1 className="font-display text-5xl leading-tight font-extrabold sm:text-7xl">
          {w.count ? `${nf.format(w.count)} people. One year with Claude.` : "The Wall is waiting."}
        </h1>
        <p className="text-lg text-cream/80">
          An opt-in, open leaderboard. Everyone here added their own stats with a pull request on GitHub. Tag your
          team, company or city and compete as a group.
        </p>
      </header>

      {w.count === 0 ? (
        <section data-testid="wall-empty" className="flex flex-col gap-3 rounded-2xl border border-line p-6">
          <h2 className="font-display text-2xl font-bold">Be the first.</h2>
          <p className="text-cream/80">
            Make your story, open the <strong>Wall</strong> tab and follow the steps. It takes a GitHub account and a
            minute.
          </p>
          <Link href="/" className="font-mono">
            Make yours →
          </Link>
        </section>
      ) : (
        <>
          {w.tags.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-2xl font-bold">Groups</h2>
              <ul className="flex flex-wrap gap-2" data-testid="wall-tags">
                {w.tags.map((t) => (
                  <li key={t.tag}>
                    <Link href={`/wall/${t.tag}`} className="inline-block rounded-full border border-line px-4 py-2 font-mono text-sm no-underline hover:border-amber">
                      #{t.tag} · {t.members}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-bold">Clubs</h2>
            <ul className="flex flex-col gap-2 font-mono text-sm">
              {clubs.map(([club, n]) => (
                <li key={club} className="flex items-center gap-3">
                  <span className="w-28 shrink-0">{club}</span>
                  <span className="h-3 rounded bg-amber" style={{ width: `${(n / biggest) * 70}%` }} />
                  <span className="text-muted">{n}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-bold">Everyone</h2>
            <Leaderboard people={w.entries} />
          </section>
        </>
      )}

      <section className="flex flex-col gap-3 rounded-2xl bg-panel p-6">
        <h2 className="font-display text-2xl font-bold">The open dataset</h2>
        <p className="text-cream/80">
          Every Wall entry, as one Parquet file, rebuilt with DuckDB on each merge. Query it straight from GitHub:
        </p>
        <pre className="overflow-auto rounded-xl bg-ink p-4 font-mono text-xs text-cream/85">
          {`-- in DuckDB
SELECT club, count(*) AS people, median(chats) AS median_chats
FROM '${REPO_URL}/raw/main/data/wall.parquet'
GROUP BY club ORDER BY people DESC;`}
        </pre>
        <a href={`${REPO_URL}/tree/main/wall`} className="font-mono text-sm">
          How the Wall works, and how to leave it →
        </a>
      </section>
    </main>
  );
}
