import type { Metadata } from "next";
import Link from "next/link";

import { StoryPage } from "@/components/story/StoryPage";

export const metadata: Metadata = { title: "Your story · AI Wrapped 2026" };

export default function Story() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <Link href="/" className="font-mono text-sm tracking-[0.25em] text-amber no-underline">
        AI WRAPPED 2026
      </Link>
      <StoryPage />
    </main>
  );
}
