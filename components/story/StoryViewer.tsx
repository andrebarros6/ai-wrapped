"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CARDS, StoryCard } from "@/components/cards/cards";
import { defaultEdits, saveEdits, type StoryEdits } from "@/lib/story/edits";
import type { CardStats } from "@/lib/story/schema";
import { THEMES } from "@/lib/story/theme";

import { EditPanel } from "./EditPanel";
import { QueryPanel } from "./QueryPanel";
import { ScaledCard } from "./ScaledCard";
import { SharePanel } from "./SharePanel";

const DURATION_MS = 6000;
const HOLD_MS = 220;
const SWIPE_PX = 50;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const mq = matchMedia(reducedMotionQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

type Panel = "none" | "edit" | "query" | "share";

interface Props {
  stats: CardStats;
  initialEdits: StoryEdits;
  titleSuggestions: string[];
  /** Save edits to this tab's session (off for the demo and shared links). */
  persist: boolean;
  /** Someone else's story from a link: no editing or sharing. */
  readOnly?: boolean;
}

export function StoryViewer({ stats, initialEdits, titleSuggestions, persist, readOnly = false }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [edits, setEdits] = useState(initialEdits);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => matchMedia(reducedMotionQuery).matches, () => false);
  const pointer = useRef<{ x: number; timer: number; held: boolean } | null>(null);

  const last = CARDS.length - 1;
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(last, i))), [last]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  const updateEdits = (e: StoryEdits) => {
    setEdits(e);
    if (persist) saveEdits(e);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Typing in the edit panel must not move the story.
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(last);
      // Space already "clicks" a focused button; don't toggle twice.
      else if (e.key === " " && !(target && /^(BUTTON|SUMMARY|A)$/.test(target.tagName))) setPaused((p) => !p);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, last, next, prev]);

  const effectivePaused = paused || holding || panel !== "none" || reducedMotion;
  const theme = THEMES[edits.theme];
  const card = CARDS[index];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
      <div className="mx-auto flex w-full flex-col gap-4" style={{ maxWidth: "min(100%, calc((100dvh - 170px) * 0.8))" }}>
        <section
          aria-roledescription="slide"
          aria-label={`Card ${index + 1} of ${CARDS.length}: ${card.label}`}
          data-testid="story-card"
          data-index={index}
          className="cursor-pointer touch-pan-y overflow-hidden rounded-2xl select-none"
          onPointerDown={(e) => {
            const timer = window.setTimeout(() => {
              if (pointer.current) pointer.current.held = true;
              setHolding(true);
            }, HOLD_MS);
            pointer.current = { x: e.clientX, timer, held: false };
          }}
          onPointerUp={(e) => {
            const p = pointer.current;
            pointer.current = null;
            if (!p) return;
            window.clearTimeout(p.timer);
            setHolding(false);
            if (p.held) return; // a hold pauses; letting go resumes
            const dx = e.clientX - p.x;
            if (Math.abs(dx) > SWIPE_PX) return dx < 0 ? next() : prev();
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX - rect.left < rect.width / 3) prev();
            else next();
          }}
          onPointerCancel={() => {
            if (pointer.current) window.clearTimeout(pointer.current.timer);
            pointer.current = null;
            setHolding(false);
          }}
        >
          <ScaledCard>
            <StoryCard
              key={`${index}-${edits.theme}`}
              index={index}
              s={stats}
              e={edits}
              t={theme}
              progress={{
                durationMs: DURATION_MS,
                paused: effectivePaused,
                onEnd: () => (index < last ? next() : setPaused(true)),
              }}
            />
          </ScaledCard>
        </section>

        <div className="flex items-center justify-between gap-2 font-mono text-sm">
          <div className="flex gap-2">
            <Ctrl label="Previous card" onClick={prev} disabled={index === 0}>
              ←
            </Ctrl>
            <Ctrl label={effectivePaused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)} testId="play-pause">
              {effectivePaused ? "▶" : "❚❚"}
            </Ctrl>
            <Ctrl label="Next card" onClick={next} disabled={index === last}>
              →
            </Ctrl>
          </div>
          <span aria-live="polite" className="text-muted" data-testid="card-counter">
            {index + 1} / {CARDS.length}
          </span>
          <button
            type="button"
            data-testid="theme-toggle"
            onClick={() => updateEdits({ ...edits, theme: edits.theme === "brand" ? "dark" : "brand" })}
            className="rounded-full border border-line px-3 py-1 hover:border-amber"
          >
            Theme: {theme.label}
          </button>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="flex gap-2 font-mono text-sm">
          {!readOnly && (
            <PanelTab
              active={panel === "share"}
              onClick={() => setPanel(panel === "share" ? "none" : "share")}
              testId="share-toggle"
            >
              Share
            </PanelTab>
          )}
          {!readOnly && (
            <PanelTab active={panel === "edit"} onClick={() => setPanel(panel === "edit" ? "none" : "edit")} testId="edit-toggle">
              Edit
            </PanelTab>
          )}
          <PanelTab
            active={panel === "query"}
            onClick={() => setPanel(panel === "query" ? "none" : "query")}
            testId="query-toggle"
          >
            Show the query
          </PanelTab>
        </div>
        {panel === "edit" && (
          <EditPanel
            edits={edits}
            onChange={updateEdits}
            onReset={() => updateEdits({ ...defaultEdits(stats), theme: edits.theme })}
            titleSuggestions={titleSuggestions}
          />
        )}
        {panel === "query" && <QueryPanel files={card.sql} />}
        {panel === "share" && <SharePanel stats={stats} edits={edits} index={index} />}
        {panel === "none" && (
          <p className="text-sm text-muted">
            Tap the right side of a card for the next one, the left side to go back, or hold to pause. Arrow keys and
            space work too.{!readOnly && " Edit the words, then share the images or a link."}
          </p>
        )}
      </aside>
    </div>
  );
}

function Ctrl(props: { label: string; onClick: () => void; disabled?: boolean; testId?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      data-testid={props.testId}
      onClick={props.onClick}
      disabled={props.disabled}
      className="h-10 w-10 rounded-full border border-line text-cream hover:border-amber disabled:opacity-30"
    >
      {props.children}
    </button>
  );
}

function PanelTab(props: { active: boolean; onClick: () => void; testId: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      data-testid={props.testId}
      onClick={props.onClick}
      className={`rounded-full border px-4 py-2 ${props.active ? "border-amber text-amber" : "border-line text-cream"}`}
    >
      {props.children}
    </button>
  );
}
