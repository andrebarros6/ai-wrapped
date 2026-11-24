"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The URL fragment without "#". null during the static prerender (the server never has it). */
export function useHash(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => location.hash.replace(/^#/, ""),
    () => null,
  );
}
