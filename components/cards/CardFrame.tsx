// The shared 1080×1350 frame from the designs: progress bar, header, CTA and the "Get yours" line.
// Inline styles only, so the same markup renders on screen and exports to PNG.
import type { CSSProperties, ReactNode } from "react";

import { SITE_LINE } from "@/lib/site";
import type { CardTheme } from "@/lib/story/theme";

export const CARD_W = 1080;
export const CARD_H = 1350;
export const TOTAL_CARDS = 8;

export interface ProgressAnimation {
  durationMs: number;
  paused: boolean;
  onEnd: () => void;
}

interface Props {
  n: number;
  label: string;
  cta: string;
  tag: string;
  t: CardTheme;
  variant?: "default" | "club";
  /** Animate the current segment (on screen). Omit for a static, full segment (PNG). */
  progress?: ProgressAnimation | null;
  children: ReactNode;
}

export function CardFrame({ n, label, cta, tag, t, variant = "default", progress, children }: Props) {
  const club = variant === "club";
  const bg = club ? t.club.bg : t.bg;
  const fg = club ? t.club.fg : t.fg;
  const link = club ? t.club.fg : t.link;

  const segment = (i: number) => {
    const base: CSSProperties = { flex: 1, height: 6, borderRadius: 3, position: "relative", overflow: "hidden" };
    const track = <div style={{ position: "absolute", inset: 0, background: fg, opacity: 0.25 }} />;
    if (i < n - 1) return <div key={i} style={{ ...base, background: fg }} />;
    if (i > n - 1) return <div key={i} style={base}>{track}</div>;
    return (
      <div key={i} style={base}>
        {track}
        <div
          data-testid="progress-current"
          onAnimationEnd={progress?.onEnd}
          style={{
            position: "absolute",
            inset: 0,
            background: fg,
            transformOrigin: "left center",
            ...(progress
              ? {
                  animation: `wrapped-fill ${progress.durationMs}ms linear forwards`,
                  animationPlayState: progress.paused ? "paused" : "running",
                }
              : {}),
          }}
        />
      </div>
    );
  };

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        boxSizing: "border-box",
        background: bg,
        color: fg,
        fontFamily: t.display,
        display: "flex",
        flexDirection: "column",
        padding: "56px 80px 64px",
        gap: 32,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>{Array.from({ length: TOTAL_CARDS }, (_, i) => segment(i))}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: t.mono,
          fontSize: 22,
          letterSpacing: 3,
          opacity: 0.7,
        }}
      >
        <span>AI WRAPPED 2026</span>
        <span>
          {n} / {TOTAL_CARDS} · {label.toUpperCase()}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, minHeight: 0 }}>
        {children}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 34, fontWeight: 800 }}>{cta}</span>
        <span style={{ fontFamily: t.mono, fontSize: 24, color: link }}>
          Get yours → {SITE_LINE}
          {tag ? ` · #${tag}` : ""}
        </span>
      </div>
    </div>
  );
}
