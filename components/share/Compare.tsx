"use client";

import Link from "next/link";
import { useMemo } from "react";

import { decodeShare, splitPair } from "@/lib/share/codec";
import { compare } from "@/lib/share/compare";
import { useHash } from "@/lib/share/useHash";

import { BrokenLink } from "./BrokenLink";

export function Compare() {
  const hash = useHash();
  const pair = useMemo(() => {
    const tokens = hash ? splitPair(hash) : null;
    if (!tokens) return null;
    const [a, b] = tokens.map(decodeShare);
    return a && b ? { a, b, tokens } : null;
  }, [hash]);

  if (hash === null) return <p className="font-mono text-muted">Loading…</p>;
  if (!pair) return <BrokenLink />;

  const nameA = pair.a.edits.display_name || "Player 1";
  const nameB = pair.b.edits.display_name || "Player 2";
  const { duels, scoreA, scoreB } = compare(pair.a.stats, pair.b.stats);
  const verdict =
    scoreA === scoreB ? "It's a draw." : `${scoreA > scoreB ? nameA : nameB} wins ${Math.max(scoreA, scoreB)}–${Math.min(scoreA, scoreB)}.`;

  return (
    <section data-testid="compare" className="flex flex-col gap-8 [overflow-wrap:anywhere]">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-sm tracking-[0.25em] text-amber">PROVE IT · AI WRAPPED 2026</p>
        <h1 className="font-display text-4xl font-extrabold sm:text-6xl" data-testid="compare-verdict">
          {verdict}
        </h1>
        <p className="text-cream/80">
          {nameA}: {pair.a.stats.club} Club · {nameB}: {pair.b.stats.club} Club
        </p>
      </header>

      <table className="w-full border-collapse font-mono text-sm sm:text-base">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-2 font-normal">Stat</th>
            <th className="py-2 text-right font-normal [overflow-wrap:anywhere]">{nameA}</th>
            <th className="py-2 text-right font-normal [overflow-wrap:anywhere]">{nameB}</th>
          </tr>
        </thead>
        <tbody>
          {duels.map((d) => (
            <tr key={d.key} data-testid={`duel-${d.key}`} data-winner={d.winner} className="border-t border-line">
              <td className="py-3 pr-2 text-cream/85">{d.label}</td>
              <Cell value={d.a} win={d.winner === "a"} />
              <Cell value={d.b} win={d.winner === "b"} />
            </tr>
          ))}
          <tr className="border-t border-line font-display text-lg font-bold">
            <td className="py-3">Total</td>
            <Cell value={String(scoreA)} win={scoreA > scoreB} />
            <Cell value={String(scoreB)} win={scoreB > scoreA} />
          </tr>
        </tbody>
      </table>

      <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm">
        <Link href={`/s#${pair.tokens[0]}`}>{nameA}&apos;s story</Link>
        <Link href={`/s#${pair.tokens[1]}`}>{nameB}&apos;s story</Link>
        <Link href="/">Make yours →</Link>
      </div>
      <p className="text-sm text-muted">
        Both sets of stats are inside this link, after the <code>#</code>. Nothing was sent to a server.
      </p>
    </section>
  );
}

function Cell({ value, win }: { value: string; win: boolean }) {
  return (
    <td className={`py-3 text-right tabular-nums ${win ? "font-bold text-amber" : "text-cream/70"}`}>
      {win && <span aria-label="winner">★ </span>}
      {value}
    </td>
  );
}
