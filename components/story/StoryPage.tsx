"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { readLocalOnly, SESSION_KEY } from "@/lib/engine/session";
import { DEMO_EDITS, DEMO_STATS } from "@/lib/story/demo";
import { loadEdits } from "@/lib/story/edits";
import { safeTitles } from "@/lib/story/safety";
import { toCardStats } from "@/lib/story/schema";

import { StoryViewer } from "./StoryViewer";

type Source = { kind: "demo" } | { kind: "session"; raw: string } | { kind: "none" };

// Where the story comes from is client-only state (URL hash, this tab's session storage).
let cache: { key: string; value: Source } | null = null;
function getSource(): Source {
  const demo = location.hash === "#demo";
  const raw = demo ? "" : (sessionStorage.getItem(SESSION_KEY) ?? "");
  const key = `${demo}|${raw}`;
  if (cache?.key !== key) {
    cache = { key, value: demo ? { kind: "demo" } : raw ? { kind: "session", raw } : { kind: "none" } };
  }
  return cache.value;
}
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export function StoryPage() {
  const source = useSyncExternalStore(subscribe, getSource, () => null);

  const story = useMemo(() => {
    if (!source || source.kind === "none") return null;
    if (source.kind === "demo") return { stats: DEMO_STATS, edits: DEMO_EDITS, suggestions: [], persist: false };
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      return null;
    }
    const stats = toCardStats(parsed);
    return {
      stats,
      edits: loadEdits(stats),
      suggestions: safeTitles(readLocalOnly()?.chattiest_day_titles ?? []),
      persist: true,
    };
  }, [source]);

  if (!source) return <p className="font-mono text-muted">Loading…</p>;

  if (!story) {
    return (
      <div data-testid="story-empty" className="flex flex-col gap-4 py-10">
        <h1 className="font-display text-4xl font-extrabold">No story here yet.</h1>
        <p className="text-cream/80">
          Your stats live only in the browser tab where you analysed your export. Start there, or look at an example.
        </p>
        <div className="flex gap-4 font-mono">
          <Link href="/">Make yours →</Link>
          <a href="#demo">See the demo →</a>
        </div>
      </div>
    );
  }

  return (
    <>
      {source.kind === "demo" && (
        <p className="mb-4 font-mono text-sm text-amber" data-testid="demo-banner">
          DEMO · André&apos;s real 2026. <Link href="/">Make yours →</Link>
        </p>
      )}
      {story.stats.source === "lite-prompt" && (
        <p className="mb-4 max-w-2xl text-sm text-cream/80" data-testid="rough-banner">
          <span className="font-mono text-amber">ROUGH ESTIMATE · </span>
          Claude guessed these from the part of your history it can search, so they can be well off (often
          30–60% low). <Link href="/">Get your exact numbers from your export →</Link>
        </p>
      )}
      <StoryViewer
        key={source.kind}
        stats={story.stats}
        initialEdits={story.edits}
        titleSuggestions={story.suggestions}
        persist={story.persist}
      />
    </>
  );
}
