// Runs the shared SQL (sql/, bundled into sql.generated.ts) on the export with DuckDB-WASM.
// Everything happens in this browser tab; the only network requests are for our own static files.
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

import { withBase } from "../site";
import { DUCKDB_DIR } from "./duckdb-assets.generated";
import { render, YEAR } from "./render";
import { LOAD_SQL, METRICS } from "./sql.generated";
import type { FullStats } from "./stats";
import type { ExportInput, NamedBlob } from "./zip";

export class UnsupportedBrowserError extends Error {}
export class MissingConversationsError extends Error {}
/** Bigger than a browser should try (see MAX_CONVERSATIONS_BYTES in zip.ts). */
export class TooBigError extends Error {}
/** conversations.json exists but isn't in Claude's export format. */
export class ExportFormatError extends Error {}

export type Stage = "reading" | "engine" | "loading" | "computing";

const CONVERSATIONS_FILE = "conversations.json";
const SOURCES_FILE = "sources.json";

// Browser-side equivalent of load_sources() in scripts/wrapped.py: same tables, same columns.
const SOURCES_SQL = `
CREATE OR REPLACE TEMP TABLE src_raw AS SELECT * FROM read_json('${SOURCES_FILE}', format = 'auto', columns = {
  projects: 'VARCHAR[]',
  design: 'STRUCT(has_messages BOOLEAN, project_name VARCHAR, has_project BOOLEAN)[]',
  artifacts: 'INTEGER',
  scheduled_runs: 'INTEGER'
});
CREATE OR REPLACE TABLE src_projects AS
  SELECT CAST(p AS TIMESTAMPTZ) AS created_at FROM (SELECT unnest(projects) AS p FROM src_raw);
CREATE OR REPLACE TABLE src_design_chats AS
  SELECT d.has_messages, d.project_name, d.has_project FROM (SELECT unnest(design) AS d FROM src_raw);
CREATE OR REPLACE TABLE src_counts AS SELECT artifacts, scheduled_runs FROM src_raw;
`;

/** Unzip in a worker. Resolves with the parts of the export the metrics need. */
export function readExportInWorker(files: NamedBlob[]): Promise<ExportInput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./unzip.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: ExportInput; code?: string; error?: string }>) => {
      worker.terminate();
      if (e.data.ok && e.data.result) resolve(e.data.result);
      else if (e.data.code === "too-big") reject(new TooBigError(e.data.error));
      else reject(new ExportFormatError(e.data.error ?? "could not read the files"));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "could not read the files"));
    };
    worker.postMessage({ files });
  });
}

export class WrappedEngine {
  private constructor(
    private readonly db: AsyncDuckDB,
    private readonly conn: AsyncDuckDBConnection,
  ) {}

  /** Start DuckDB (≈7 MB, cached by the browser after the first visit). */
  static async start(): Promise<WrappedEngine> {
    const duckdb = await import("@duckdb/duckdb-wasm");
    const features = await duckdb.getPlatformFeatures();
    if (!features.wasmExceptions) throw new UnsupportedBrowserError("browser too old for WebAssembly exceptions");
    const worker = new Worker(withBase(`${DUCKDB_DIR}/duckdb-browser-eh.worker.js`));
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(withBase(`${DUCKDB_DIR}/duckdb-eh.wasm`));
    const conn = await db.connect();
    // Extensions come from our own origin, never from extensions.duckdb.org.
    const repo = `${location.origin}${withBase(`${DUCKDB_DIR}/ext`)}`.replace(/'/g, "");
    await conn.query(`SET custom_extension_repository = '${repo}'`);
    await conn.query(`SET autoinstall_extension_repository = '${repo}'`);
    await conn.query("LOAD json");
    await conn.query("LOAD icu");
    return new WrappedEngine(db, conn);
  }

  /** Register the export with DuckDB. Must be called before compute(). */
  async load(input: ExportInput): Promise<void> {
    if (!input.conversations) throw new MissingConversationsError("conversations.json not found");
    if (input.conversations.byteLength < 2) throw new ExportFormatError("conversations.json is empty");
    await this.db.registerFileBuffer(CONVERSATIONS_FILE, input.conversations);
    await this.db.registerFileText(
      SOURCES_FILE,
      JSON.stringify({
        projects: input.projects,
        design: input.designChats,
        artifacts: input.artifacts,
        scheduled_runs: input.scheduledRuns,
      }),
    );
    await this.exec(SOURCES_SQL);
  }

  /** Build the model for a timezone and run every metric file. */
  async compute(tz: string, year = YEAR): Promise<FullStats> {
    const params = { conversations: CONVERSATIONS_FILE, tz, year };
    try {
      // Reading the user's file is where a malformed export fails: report it as such, not as
      // a raw DuckDB error. (The details still go to the console for bug reports.)
      await this.exec(render(LOAD_SQL, params));
    } catch (err) {
      console.error("AI Wrapped: could not load conversations.json", err);
      throw new ExportFormatError("conversations.json couldn't be read");
    }
    const out: FullStats = {};
    for (const m of METRICS) {
      const table = await this.conn.query(render(m.sql, params));
      const row = table.toArray()[0] as { j?: unknown } | undefined;
      if (!row || row.j == null) throw new Error(`${m.name} returned no row`);
      Object.assign(out, JSON.parse(String(row.j)));
    }
    return out;
  }

  async close(): Promise<void> {
    await this.conn.close();
    await this.db.terminate();
  }

  // DuckDB-WASM's query() runs one statement at a time; our SQL files separate statements
  // with ";" at the end of a line (no semicolons inside strings), so splitting there is safe.
  private async exec(sql: string): Promise<void> {
    for (const stmt of splitStatements(sql)) await this.conn.query(stmt);
  }
}

export function splitStatements(sql: string): string[] {
  return sql
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/^\s*--.*$/gm, "").trim().length > 0);
}
