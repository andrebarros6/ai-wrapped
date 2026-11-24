import type { Metadata } from "next";
import Link from "next/link";

import { Compare } from "@/components/share/Compare";

export const metadata: Metadata = { title: "Compare · AI Wrapped 2026" };

export default function ComparePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <Link href="/" className="font-mono text-sm tracking-[0.25em] text-amber no-underline">
        AI WRAPPED 2026
      </Link>
      <Compare />
    </main>
  );
}
