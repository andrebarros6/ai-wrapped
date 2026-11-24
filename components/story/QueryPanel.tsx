import { METRICS } from "@/lib/engine/sql.generated";
import { REPO_URL } from "@/lib/site";

/** "Show the query": the exact SQL behind the current card. */
export function QueryPanel({ files }: { files: string[] }) {
  return (
    <div data-testid="query-panel" className="flex flex-col gap-3">
      <p className="text-sm text-cream/80">
        These are the exact SQL files that produced this card&apos;s numbers, run by DuckDB inside your browser.
      </p>
      {files.map((name) => {
        const sql = METRICS.find((m) => m.name === name)?.sql ?? "";
        return (
          <details key={name} open={files.length === 1} className="rounded-xl border border-line">
            <summary className="cursor-pointer px-4 py-2 font-mono text-sm text-amber">sql/metrics/{name}</summary>
            <pre className="max-h-80 overflow-auto px-4 pb-4 font-mono text-xs leading-relaxed text-cream/85">{sql}</pre>
          </details>
        );
      })}
      <a href={`${REPO_URL}/tree/main/sql`} className="font-mono text-sm">
        All the SQL on GitHub →
      </a>
    </div>
  );
}
