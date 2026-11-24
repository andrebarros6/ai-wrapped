"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { StoryViewer } from "@/components/story/StoryViewer";
import { readSession } from "@/lib/engine/session";
import { decodeShare, encodeShare } from "@/lib/share/codec";
import { useHash } from "@/lib/share/useHash";
import { loadEdits } from "@/lib/story/edits";
import { toCardStats } from "@/lib/story/schema";

import { BrokenLink } from "./BrokenLink";

export function SharedStory() {
  const hash = useHash();
  const router = useRouter();
  const shared = useMemo(() => (hash ? decodeShare(hash) : null), [hash]);

  if (hash === null) return <p className="font-mono text-muted">Loading…</p>;
  if (!shared) return <BrokenLink />;

  const owner = shared.edits.display_name ? `${shared.edits.display_name}'s` : "Someone's";
  const compareWithMine = () => {
    const mine = readSession();
    if (!mine) return router.push("/");
    const stats = toCardStats(mine);
    router.push(`/vs#${hash}.${encodeShare(stats, loadEdits(stats))}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2" data-testid="shared-banner">
        <h1 className="font-display text-2xl font-extrabold">{owner} AI Wrapped 2026</h1>
        <Link href="/" className="font-mono text-sm">
          Make yours →
        </Link>
        <button type="button" onClick={compareWithMine} data-testid="compare-with-mine" className="font-mono text-sm text-coral underline">
          Compare with mine →
        </button>
      </div>
      <StoryViewer
        key={hash}
        stats={shared.stats}
        initialEdits={shared.edits}
        titleSuggestions={[]}
        persist={false}
        readOnly
      />
    </>
  );
}
