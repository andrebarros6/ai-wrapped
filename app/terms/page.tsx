import type { Metadata } from "next";

import { LegalPage } from "@/components/LegalPage";
import { REPO_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms · AI Wrapped 2026" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="24 November 2026">
      <p>
        AI Wrapped is a free, open-source side project by André Barros (Barros Builds). By using it you agree to
        these terms.
      </p>

      <h2>What it is</h2>
      <ul>
        <li>A tool that turns your own Claude data export into stats and shareable cards, inside your browser.</li>
        <li>
          Not affiliated with, endorsed by or sponsored by Anthropic. &quot;Claude&quot; is a trademark of
          Anthropic, used here only to describe what the tool works with.
        </li>
        <li>
          The source code is available under the <a href={`${REPO_URL}/blob/main/LICENSE`}>MIT licence</a>.
        </li>
      </ul>

      <h2>Your data and what you share</h2>
      <ul>
        <li>Only use exports of your own account.</li>
        <li>
          You decide what to share. Review cards before posting them, and don&apos;t share anything you&apos;d
          rather keep private.
        </li>
        <li>
          Wall entries must not contain offensive names or tags, or other people&apos;s personal information. We may
          decline or remove entries at our discretion.
        </li>
      </ul>

      <h2>No warranty</h2>
      <p>
        The tool is provided &quot;as is&quot;, without warranty of any kind. Numbers are estimates derived from the
        export (for example, tokens are estimated from characters) and may contain mistakes. To the extent permitted
        by law, we are not liable for any loss arising from using the site or relying on its numbers.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms; the date above shows the latest version.</p>
    </LegalPage>
  );
}
