// Reads the Claude export ZIPs in the browser. Every entry is classified by its *name* (from the
// ZIP's central directory) before anything is decompressed. Only the entries the metrics need are
// ever opened; private ones (light_metadata, memories, artifact_data) and artifact contents never are.
import JSZip from "jszip";

export type FoundKind = "conversations" | "projects" | "design_chats" | "claude_code_cloud" | "frames";
export type IgnoredKind = "light_metadata" | "memories" | "artifact_data";

export interface DesignChat {
  has_messages: boolean;
  project_name: string | null;
  has_project: boolean;
}

export interface ExportInput {
  conversations: Uint8Array | null;
  projects: (string | null)[]; // created_at of each project
  designChats: DesignChat[];
  artifacts: number; // counted from entry names only
  scheduledRuns: number | null; // null when the claude_code_cloud ZIP is absent
  found: FoundKind[];
  ignored: IgnoredKind[];
  unreadable: string[]; // dropped files we couldn't use (names only)
}

export type EntryAction =
  | { kind: "ignore"; reason: IgnoredKind }
  | { kind: "open"; what: "conversations" | "project" | "design_chat" | "routine_runs" }
  | { kind: "count"; what: "artifact" }
  | { kind: "skip"; seen?: "claude_code_cloud" | "frames" };

/** Decide what to do with a ZIP entry from its path alone. Private kinds are checked first. */
export function classifyEntry(path: string): EntryAction {
  const p = path.replace(/\\/g, "/");
  if (/(^|\/)(users|login_history)\.json$/.test(p) || /(^|\/)light_metadata/.test(p)) {
    return { kind: "ignore", reason: "light_metadata" };
  }
  if (/(^|\/)memories(\/|$)/.test(p)) return { kind: "ignore", reason: "memories" };
  if (/(^|\/)artifacts\/[^/]+\/data(\/|$)/.test(p)) return { kind: "ignore", reason: "artifact_data" };
  if (/(^|\/)conversations\.json$/.test(p)) return { kind: "open", what: "conversations" };
  if (/(^|\/)projects\/[^/]+\.json$/.test(p)) return { kind: "open", what: "project" };
  if (/(^|\/)design_chats\/[^/]+\.json$/.test(p)) return { kind: "open", what: "design_chat" };
  if (/(^|\/)claude_code_cloud\/routine_runs\.json$/.test(p)) return { kind: "open", what: "routine_runs" };
  if (/(^|\/)claude_code_cloud\//.test(p)) return { kind: "skip", seen: "claude_code_cloud" };
  if (/(^|\/)artifacts\/[^/]+\/artifact\.json$/.test(p)) return { kind: "count", what: "artifact" };
  if (/(^|\/)artifacts\//.test(p)) return { kind: "skip", seen: "frames" };
  return { kind: "skip" };
}

export interface NamedBlob {
  name: string;
  blob: Blob;
}

function emptyInput(): ExportInput {
  return {
    conversations: null,
    projects: [],
    designChats: [],
    artifacts: 0,
    scheduledRuns: null,
    found: [],
    ignored: [],
    unreadable: [],
  };
}

function add<T>(list: T[], item: T): void {
  if (!list.includes(item)) list.push(item);
}

const truthy = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== false && v !== 0 && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Read the dropped files (export ZIPs, or a loose conversations.json). */
export async function readExport(files: NamedBlob[]): Promise<ExportInput> {
  const out = emptyInput();
  for (const { name, blob } of files) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".json")) {
      const action = classifyEntry(lower);
      if (action.kind === "open" && action.what === "conversations" && !out.conversations) {
        out.conversations = new Uint8Array(await blob.arrayBuffer());
        add(out.found, "conversations");
      } else if (action.kind === "ignore") {
        add(out.ignored, action.reason);
      } else {
        out.unreadable.push(name);
      }
      continue;
    }
    if (!lower.endsWith(".zip")) {
      out.unreadable.push(name);
      continue;
    }
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(blob);
    } catch {
      out.unreadable.push(name);
      continue;
    }
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const action = classifyEntry(entry.name);
      switch (action.kind) {
        case "ignore":
          add(out.ignored, action.reason);
          break;
        case "count":
          out.artifacts += 1;
          add(out.found, "frames");
          break;
        case "skip":
          if (action.seen) add(out.found, action.seen);
          break;
        case "open":
          await openEntry(entry, action.what, out);
          break;
      }
    }
  }
  return out;
}

async function openEntry(
  entry: JSZip.JSZipObject,
  what: "conversations" | "project" | "design_chat" | "routine_runs",
  out: ExportInput,
): Promise<void> {
  if (what === "conversations") {
    if (out.conversations) return; // first one wins
    out.conversations = await entry.async("uint8array");
    add(out.found, "conversations");
    return;
  }
  const data: unknown = JSON.parse(await entry.async("string"));
  const obj = (data ?? {}) as Record<string, unknown>;
  if (what === "project") {
    out.projects.push(typeof obj.created_at === "string" ? obj.created_at : null);
    add(out.found, "projects");
  } else if (what === "design_chat") {
    const project = obj.project as Record<string, unknown> | null | undefined;
    out.designChats.push({
      has_messages: truthy(obj.messages),
      project_name: truthy(project) && typeof project?.name === "string" ? project.name : null,
      has_project: truthy(project),
    });
    add(out.found, "design_chats");
  } else {
    const runs = obj.claude_code_cloud;
    out.scheduledRuns = Array.isArray(runs) ? runs.length : 0;
    add(out.found, "claude_code_cloud");
  }
}
