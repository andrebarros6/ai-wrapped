"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, useSyncExternalStore } from "react";

import {
  ExportFormatError,
  MissingConversationsError,
  TooBigError,
  readExportInWorker,
  type Stage,
  UnsupportedBrowserError,
  WrappedEngine,
} from "@/lib/engine/engine";
import { detectTimeZone, isValidTimeZone } from "@/lib/engine/render";
import { saveSession, type SessionStats } from "@/lib/engine/session";
import { splitStats } from "@/lib/engine/stats";
import { clearEdits } from "@/lib/story/edits";
import type { ExportInput, FoundKind, IgnoredKind } from "@/lib/engine/zip";

type Phase =
  | { kind: "idle" }
  | { kind: "working"; stage: Stage }
  | { kind: "done"; stats: SessionStats }
  | { kind: "error"; message: string };

const STAGE_TEXT: Record<Stage, string> = {
  reading: "Reading your ZIPs…",
  engine: "Starting the database in your browser…",
  loading: "Loading your chats…",
  computing: "Counting…",
};

const FOUND_TEXT: Record<FoundKind, string> = {
  conversations: "Chats",
  projects: "Projects",
  design_chats: "Design chats",
  claude_code_cloud: "Scheduled tasks",
  frames: "Artifacts (counted by name only)",
};

const IGNORED_TEXT: Record<IgnoredKind, string> = {
  light_metadata: "light_metadata (email, phone, login IPs)",
  memories: "memories",
  artifact_data: "artifact_data",
};

const fmt = new Intl.NumberFormat("en");

// The browser's timezone and zone list are external, client-only values. useSyncExternalStore
// gives the static prerender a stable server value ("UTC", no list) without hydration mismatches.
const noSubscribe = () => () => {};
let zoneList: string[] | null = null;
const getZoneList = (): string[] => {
  if (!zoneList) {
    try {
      zoneList = Intl.supportedValuesOf("timeZone");
    } catch {
      zoneList = [];
    }
  }
  return zoneList;
};
const NO_ZONES: string[] = [];

export function Analyzer() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const detectedTz = useSyncExternalStore(noSubscribe, detectTimeZone, () => "UTC");
  const timeZones = useSyncExternalStore(noSubscribe, getZoneList, () => NO_ZONES);
  // Inputs stay disabled until React has hydrated, so nothing typed or dropped earlier is lost.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [tzChoice, setTzChoice] = useState<string | null>(null);
  const [tzEdit, setTzEdit] = useState<string | null>(null);
  const tz = tzChoice ?? detectedTz;
  const tzDraft = tzEdit ?? tz;
  const [input, setInput] = useState<ExportInput | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showZones, setShowZones] = useState(false); // ~420 options: only render once the field is used
  const engineRef = useRef<Promise<WrappedEngine> | null>(null);
  const tzListId = useId();
  const tzInputId = useId();
  // Refs mirror the timezone synchronously, so a drop right after typing a zone can't use a stale one.
  const tzChoiceRef = useRef<string | null>(null);
  const tzEditRef = useRef<string | null>(null);

  const commitTz = useCallback((next: string) => {
    tzChoiceRef.current = next;
    tzEditRef.current = null;
    setTzChoice(next);
    setTzEdit(null);
  }, []);

  /** The zone to use now: a valid zone still being typed wins, then the chosen one, then detected. */
  const currentTz = useCallback((): string => {
    const typed = tzEditRef.current;
    if (typed !== null && isValidTimeZone(typed)) {
      commitTz(typed);
      return typed;
    }
    return tzChoiceRef.current ?? detectedTz;
  }, [commitTz, detectedTz]);

  /** Start DuckDB early (on hover/focus) so it's ready by the time the files are read. */
  const warmUp = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = WrappedEngine.start();
      engineRef.current.catch(() => {
        engineRef.current = null;
      });
    }
    return engineRef.current;
  }, []);

  const compute = useCallback(
    async (data: ExportInput, zone: string, alreadyLoaded: boolean) => {
      setPhase({ kind: "working", stage: "engine" });
      const engine = await warmUp();
      if (!alreadyLoaded) {
        setPhase({ kind: "working", stage: "loading" });
        await engine.load(data);
      }
      setPhase({ kind: "working", stage: "computing" });
      const full = await engine.compute(zone);
      const stats = saveSession(splitStats(full), zone);
      if (!alreadyLoaded) clearEdits(); // a new export is a new story; a timezone change keeps edits
      setPhase({ kind: "done", stats });
    },
    [warmUp],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;
      setPhase({ kind: "working", stage: "reading" });
      void warmUp();
      try {
        const data = await readExportInWorker(files.map((f) => ({ name: f.name, blob: f })));
        setInput(data);
        if (!data.conversations) throw new MissingConversationsError();
        await compute(data, currentTz(), false);
      } catch (err) {
        setPhase({ kind: "error", message: errorMessage(err) });
      }
    },
    [compute, currentTz, warmUp],
  );

  const changeTz = useCallback(
    async (next: string) => {
      if (!isValidTimeZone(next)) return;
      commitTz(next);
      if (input?.conversations && phase.kind === "done") {
        try {
          await compute(input, next, true);
        } catch (err) {
          setPhase({ kind: "error", message: errorMessage(err) });
        }
      }
    },
    [commitTz, compute, input, phase.kind],
  );

  const busy = phase.kind === "working";
  const tzInvalid = tzDraft !== tz && !isValidTimeZone(tzDraft);

  return (
    <div className="flex flex-col gap-6" data-hydrated={hydrated}>
      <label
        data-testid="dropzone"
        onPointerEnter={warmUp}
        onFocus={warmUp}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-within:border-amber ${
          dragging ? "border-amber bg-panel" : "border-line hover:border-muted"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-display text-2xl font-extrabold">Drop your export ZIPs here</span>
        <span className="text-muted">or tap to choose them · conversations-000.zip is the one that matters</span>
        <input
          data-testid="file-input"
          type="file"
          multiple
          accept=".zip,.json,application/zip,application/json"
          className="sr-only"
          disabled={busy || !hydrated}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
        <label htmlFor={tzInputId} className="text-muted">
          Your timezone
        </label>
        <input
          id={tzInputId}
          onFocus={() => setShowZones(true)}
          data-testid="tz-input"
          list={tzListId}
          value={tzDraft}
          disabled={busy || !hydrated}
          onChange={(e) => {
            tzEditRef.current = e.target.value;
            setTzEdit(e.target.value);
          }}
          // Read the live DOM value: a closure's tzDraft can be one render behind.
          onBlur={(e) => void changeTz(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void changeTz(e.currentTarget.value);
          }}
          aria-invalid={tzInvalid}
          className="min-w-56 rounded-lg border border-line bg-panel px-3 py-2 text-cream"
        />
        <datalist id={tzListId}>
          {(showZones ? timeZones : NO_ZONES).map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <span className="text-muted">Hours and days are counted in this zone.</span>
        {tzInvalid && <span className="text-coral">Not a timezone we know. Try e.g. Europe/Lisbon.</span>}
      </div>

      <div aria-live="polite" data-testid="status" data-phase={phase.kind}>
        {phase.kind === "working" && <p className="font-mono text-amber">{STAGE_TEXT[phase.stage]}</p>}
        {phase.kind === "error" && (
          <p role="alert" className="text-coral">
            {phase.message}
          </p>
        )}
      </div>

      {input && <SourceChecklist input={input} />}

      {phase.kind === "done" && <Summary stats={phase.stats} />}
    </div>
  );
}

function SourceChecklist({ input }: { input: ExportInput }) {
  return (
    <ul data-testid="sources" className="flex flex-col gap-1 font-mono text-sm">
      {(Object.keys(FOUND_TEXT) as FoundKind[]).map((k) => (
        <li key={k} className={input.found.includes(k) ? "text-cream" : "text-muted"}>
          {input.found.includes(k) ? "✓" : "·"} {FOUND_TEXT[k]}
          {!input.found.includes(k) && k !== "conversations" && " (not dropped, optional)"}
        </li>
      ))}
      {input.ignored.map((k) => (
        <li key={k} data-testid={`ignored-${k}`} className="text-amber">
          ✕ {IGNORED_TEXT[k]}: ignored, never opened
        </li>
      ))}
    </ul>
  );
}

function Summary({ stats }: { stats: SessionStats }) {
  const tiles: [string, unknown][] = [
    ["chats started", stats.chats],
    ["messages sent", stats.your_messages],
    ["active days", stats.active_days],
    ["web searches", stats.web_searches],
  ];
  return (
    <section data-testid="summary" className="rounded-2xl bg-panel p-6">
      <p className="font-mono text-sm tracking-widest text-amber">YOUR 2026 · {stats.tz}</p>
      <dl className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-xs text-muted">{label}</dt>
            <dd className="font-display text-4xl font-extrabold text-amber">
              {typeof value === "number" ? fmt.format(value) : "–"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-muted">
        You&apos;re in the <strong className="text-cream">{String(stats.club)}</strong> club.
      </p>
      <Link
        href="/story"
        data-testid="see-story"
        className="mt-6 inline-block rounded-full bg-amber px-6 py-3 font-display text-lg font-bold text-ink no-underline hover:bg-amber-hi hover:text-ink"
      >
        See your story →
      </Link>
    </section>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof MissingConversationsError) {
    return "We couldn't find conversations.json. Drop conversations-000.zip (the other ZIPs are optional).";
  }
  if (err instanceof TooBigError) {
    return "That export is too big to analyse in a browser (over 600 MB). The command-line version on GitHub has no limit.";
  }
  if (err instanceof ExportFormatError) {
    return "This doesn't look like a Claude export: conversations.json couldn't be read. If it is one, please open an issue on GitHub.";
  }
  if (err instanceof UnsupportedBrowserError) {
    return "Your browser is too old to run the analysis. Try a recent Chrome, Edge, Firefox or Safari.";
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error("AI Wrapped:", err); // details for bug reports, kept out of the page
  if (/memory|allocation/i.test(msg)) {
    return "Your browser ran out of memory. Try a desktop browser, or use the CLI from the GitHub repo.";
  }
  return "Something went wrong reading your export. Please try again, or open an issue on GitHub.";
}
