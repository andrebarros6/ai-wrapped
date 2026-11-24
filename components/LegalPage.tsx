import Link from "next/link";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-14 text-cream/90 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-cream [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
      <Link href="/" className="font-mono text-sm">
        ← AI Wrapped
      </Link>
      <h1 className="font-display text-4xl font-extrabold text-cream">{title}</h1>
      <p className="font-mono text-sm text-muted">Last updated {updated}</p>
      {children}
    </main>
  );
}
