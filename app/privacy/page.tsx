import type { Metadata } from "next";

import { LegalPage } from "@/components/LegalPage";
import { MAIN_SITE_URL, REPO_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy · AI Wrapped 2026" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="24 November 2026">
      <p>
        AI Wrapped is built so that we never receive your data. There is no backend, no database and no account.
        This page explains exactly what happens, and what little does leave your device.
      </p>

      <h2>Your export stays in your browser</h2>
      <ul>
        <li>
          The ZIP files you drop are read by your browser tab. The analysis runs locally with DuckDB-WASM, a
          database compiled to run inside the browser. Your chats, titles and messages are never sent to us or to
          anyone else.
        </li>
        <li>
          We only open the files the stats need: <code>conversations.json</code>, project and design-chat files
          (dates and counts), and the scheduled-runs list. We count artifact folders by name without opening them.
        </li>
        <li>
          We never open <code>light_metadata</code> (your email, phone and login IPs), <code>memories</code> or{" "}
          <code>artifact_data</code>, even if you drop them.
        </li>
        <li>
          Results are kept in your tab&apos;s session storage so the story pages can read them. Closing the tab
          deletes them. Chat titles and your own words are kept in memory only and are gone after a reload.
        </li>
        <li>
          The site loads its own code, fonts and the DuckDB engine from this domain. It makes no requests to
          other websites while analysing your export.
        </li>
      </ul>

      <h2>When you share</h2>
      <ul>
        <li>
          Cards you download as images are created in your browser. Where you post them is up to you.
        </li>
        <li>
          Share and compare links put your stats after the <code>#</code> in the URL. Browsers do not send that
          part to any server, so we never see it, but anyone you give the link to can read the stats in it.
        </li>
        <li>
          Shared stats never include chat titles or your own words. Text drawn from titles (like a one-line
          summary) only appears if you choose it and edit it yourself.
        </li>
      </ul>

      <h2>The Wall (optional)</h2>
      <p>
        To appear on the Wall you open a pull request on GitHub yourself, adding a file with your stats, a display
        name and a group tag. It becomes part of a public repository and open dataset, under GitHub&apos;s own terms
        and privacy policy. To remove it, open a pull request deleting your file or{" "}
        <a href={`${REPO_URL}/issues`}>open an issue</a> and we&apos;ll remove it. Git history keeps earlier
        versions of public repositories, so only submit what you&apos;re happy to publish.
      </p>

      <h2>Analytics</h2>
      <p>
        We use Vercel Web Analytics to count page views. It uses no cookies and doesn&apos;t identify you: it
        records the page path, referrer, and approximate browser, device, operating system and country. We record no
        custom events and nothing about your export.
      </p>

      <h2>Hosting</h2>
      <p>
        The site is static files hosted by Vercel and served through barrosbuilds.com. Like any web host, Vercel
        processes your IP address to deliver the pages. We don&apos;t receive or store server logs of our own.
      </p>

      <h2>Your rights</h2>
      <p>
        We hold no personal data about you from this site, so there is nothing to access or delete beyond an
        optional Wall entry (see above). There are no accounts. Questions:{" "}
        <a href={`${REPO_URL}/issues`}>GitHub issues</a> or <a href={MAIN_SITE_URL}>barrosbuilds.com</a>.
      </p>

      <h2>Changes</h2>
      <p>
        If this changes, we&apos;ll update this page and the date above. The code is open source, so you can always
        check what it does.
      </p>
    </LegalPage>
  );
}
