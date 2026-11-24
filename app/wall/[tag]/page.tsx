import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/wall/Leaderboard";
import { EVERYONE, WALL_DATA } from "@/lib/wall/data";

// One static page per group tag, plus "everyone" (so there's always at least one page to build).
export const dynamicParams = false;

export function generateStaticParams(): { tag: string }[] {
  return [{ tag: EVERYONE }, ...WALL_DATA.tags.map((t) => ({ tag: t.tag }))];
}

export async function generateMetadata({ params }: PageProps<"/wall/[tag]">): Promise<Metadata> {
  const { tag } = await params;
  return { title: `${tag === EVERYONE ? "Everyone" : `#${tag}`} · The Wall · AI Wrapped 2026` };
}

export default async function TagPage({ params }: PageProps<"/wall/[tag]">) {
  const { tag } = await params;
  const people = tag === EVERYONE ? WALL_DATA.entries : WALL_DATA.entries.filter((p) => p.tag === tag);
  if (tag !== EVERYONE && people.length === 0) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link href="/wall" className="font-mono text-sm tracking-[0.25em] text-amber no-underline">
          ← THE WALL
        </Link>
        <h1 className="font-display text-5xl font-extrabold sm:text-7xl" data-testid="tag-title">
          {tag === EVERYONE ? "Everyone" : `#${tag}`}
        </h1>
        <p className="text-cream/80">
          {people.length} {people.length === 1 ? "person" : "people"} on the Wall
          {tag === EVERYONE ? "." : " with this tag. Add yours from the Wall tab of your story."}
        </p>
      </header>
      {people.length ? (
        <Leaderboard people={people} />
      ) : (
        <p className="text-cream/80" data-testid="wall-empty">
          Nobody yet. <Link href="/">Be the first →</Link>
        </p>
      )}
    </main>
  );
}
