"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { CARD_H, CARD_W } from "@/components/cards/CardFrame";

/** Shows a fixed 1080×1350 card scaled to the width of its container. */
export function ScaledCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / CARD_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${CARD_W} / ${CARD_H}`, position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: scale ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
