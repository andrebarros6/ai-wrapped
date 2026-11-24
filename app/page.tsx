import Link from "next/link";

import { Analyzer } from "@/components/upload/Analyzer";
import { REPO_URL } from "@/lib/site";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-16 px-6 py-14">
      <header className="flex flex-col gap-5">
        <p className="font-mono text-sm tracking-[0.25em] text-amber">AI WRAPPED 2026</p>
        <h1 className="font-display text-5xl leading-[1.02] font-extrabold sm:text-7xl">
          Your year with Claude, in eight cards.
        </h1>
        <p className="max-w-xl text-lg text-cream/80">
          Drop your Claude export. We count the chats, the 2am questions and the thank-yous, right here in your
          browser. Nothing is uploaded. There&apos;s no server to upload it to.
        </p>
      </header>

      <section aria-labelledby="how" className="flex flex-col gap-6">
        <h2 id="how" className="font-display text-2xl font-bold">
          Three steps, about five minutes
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          <Step n={1} title="Ask Claude for your data">
            On claude.ai (web or desktop): Settings → Privacy → Export data. It arrives by email.
          </Step>
          <Step n={2} title="Download the ZIPs">
            <code>conversations</code> is the one that matters. <code>projects</code>, <code>design_chats</code>,{" "}
            <code>claude_code_cloud</code> and <code>frames</code> add more. Skip <code>light_metadata</code>: it
            holds your email and login IPs.
          </Step>
          <Step n={3} title="Drop them below">
            DuckDB, a database that runs inside this tab, does the counting. Links expire after 24 hours, so
            don&apos;t wait too long.
          </Step>
        </ol>
      </section>

      <section aria-label="Analyse your export">
        <Analyzer />
      </section>

      <section aria-labelledby="private" className="rounded-2xl border border-line p-6">
        <h2 id="private" className="font-display text-2xl font-bold">
          How private is this?
        </h2>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-cream/85">
          <li>Your files are read by this browser tab. Nothing about your chats is sent anywhere.</li>
          <li>Don&apos;t take our word for it: open DevTools → Network while it runs.</li>
          <li>Chat titles and your own words never leave this device, even when you share a card.</li>
          <li>
            If you drop <code>light_metadata</code> by mistake, we skip it without opening it.
          </li>
          <li>
            Every number comes from SQL you can read: <a href={`${REPO_URL}/tree/main/sql`}>sql/ on GitHub</a>.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          Details in the <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>

      <section aria-labelledby="ways" className="flex flex-col gap-4">
        <h2 id="ways" className="font-display text-2xl font-bold">
          Other ways in
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-panel p-5">
            <dt className="font-mono text-sm text-amber">PROMPT KIT</dt>
            <dd className="mt-2 text-cream/85">
              Rather not use a website? Run a prompt in your own Claude account and paste the result here.
              Coming soon.
            </dd>
          </div>
          <div className="rounded-2xl bg-panel p-5">
            <dt className="font-mono text-sm text-amber">COMMAND LINE</dt>
            <dd className="mt-2 text-cream/85">
              <code>python scripts/wrapped.py export/ Europe/Lisbon</code> runs the same SQL on your machine.{" "}
              <a href={REPO_URL}>Get it on GitHub</a>.
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-panel p-5">
      <span className="font-mono text-sm text-amber">0{n}</span>
      <span className="font-display text-lg font-bold">{title}</span>
      <span className="text-sm text-cream/80">{children}</span>
    </li>
  );
}
