import Link from "next/link";

export function BrokenLink() {
  return (
    <div data-testid="broken-link" className="flex flex-col gap-4 py-10">
      <h1 className="font-display text-4xl font-extrabold">This link doesn&apos;t work.</h1>
      <p className="text-cream/80">
        It may have been cut off when it was copied. Ask for the full link, or make your own story.
      </p>
      <Link href="/" className="font-mono">
        Make yours →
      </Link>
    </div>
  );
}
