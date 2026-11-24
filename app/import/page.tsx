import type { Metadata } from "next";
import Link from "next/link";

import { ImportPanel } from "@/components/import/ImportPanel";

export const metadata: Metadata = { title: "Prompt kit · AI Wrapped 2026" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-4">
        <Link href="/" className="font-mono text-sm tracking-[0.25em] text-amber no-underline">
          AI WRAPPED 2026 · PROMPT KIT
        </Link>
        <h1 className="font-display text-4xl leading-tight font-extrabold sm:text-6xl">Do it in your own Claude.</h1>
        <p className="text-lg text-cream/80">
          Run a prompt in your own Claude account, then paste the reply here. Your chats stay where they already are;
          only the totals come back, and they never leave this browser unless you share them.
        </p>
      </header>
      <ImportPanel />
    </main>
  );
}
