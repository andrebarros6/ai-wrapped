import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

import { decoyZips, fixtureZips, SENTINEL, type ZipFile } from "@/e2e/fixtures";

import { classifyEntry, ExportTooBigError, MAX_SMALL_FILE_BYTES, readExport } from "./zip";

const blobs = (files: ZipFile[]) => files.map((f) => ({ name: f.name, blob: new Blob([new Uint8Array(f.buffer)]) }));

describe("classifyEntry", () => {
  it.each([
    ["conversations.json", { kind: "open", what: "conversations" }],
    ["projects/3f2a.json", { kind: "open", what: "project" }],
    ["design_chats/9c.json", { kind: "open", what: "design_chat" }],
    ["claude_code_cloud/routine_runs.json", { kind: "open", what: "routine_runs" }],
    ["claude_code_cloud/routines.json", { kind: "skip", seen: "claude_code_cloud" }],
    ["artifacts/abc/artifact.json", { kind: "count", what: "artifact" }],
    ["artifacts/abc/page.md", { kind: "skip", seen: "frames" }],
    ["artifacts/abc/versions/1/artifact.json", { kind: "skip", seen: "frames" }],
    ["artifacts/abc/data/documents.json", { kind: "ignore", reason: "artifact_data" }],
    ["users.json", { kind: "ignore", reason: "light_metadata" }],
    ["login_history.json", { kind: "ignore", reason: "light_metadata" }],
    ["light_metadata-000/whatever.json", { kind: "ignore", reason: "light_metadata" }],
    ["memories/x.json", { kind: "ignore", reason: "memories" }],
    ["random/notes.txt", { kind: "skip" }],
  ])("%s", (path, expected) => {
    expect(classifyEntry(path)).toEqual(expected);
  });

  it("checks private names before anything else", () => {
    expect(classifyEntry("projects/users.json")).toEqual({ kind: "ignore", reason: "light_metadata" });
    expect(classifyEntry("memories/conversations.json")).toEqual({ kind: "ignore", reason: "memories" });
  });
});

describe("readExport", () => {
  afterEach(() => vi.restoreAllMocks());

  /** Records every entry whose contents get decompressed. */
  function spyOnOpens(): string[] {
    const opened: string[] = [];
    const real = JSZip.loadAsync.bind(JSZip);
    vi.spyOn(JSZip, "loadAsync").mockImplementation(async (...args: Parameters<typeof JSZip.loadAsync>) => {
      const zip = await real(...args);
      for (const entry of Object.values(zip.files)) {
        // Both ways of decompressing an entry are watched.
        const orig = entry.async.bind(entry);
        entry.async = ((type: Parameters<typeof orig>[0]) => {
          opened.push(entry.name);
          return orig(type);
        }) as typeof entry.async;
        const streaming = entry as unknown as { internalStream: (t: string) => unknown };
        const origStream = streaming.internalStream.bind(entry);
        streaming.internalStream = (t: string) => {
          opened.push(entry.name);
          return origStream(t);
        };
      }
      return zip;
    });
    return opened;
  }

  it("reads every category of the edge-case export", async () => {
    const out = await readExport(blobs(await fixtureZips("edge-cases")));
    expect(out.conversations?.byteLength).toBeGreaterThan(1000);
    expect(out.projects).toHaveLength(3);
    expect(out.designChats).toHaveLength(4);
    expect(out.designChats.filter((d) => d.has_messages)).toHaveLength(3);
    expect(out.designChats.find((d) => !d.has_project)).toEqual({
      has_messages: true,
      project_name: null,
      has_project: false,
    });
    expect(out.artifacts).toBe(3);
    expect(out.scheduledRuns).toBe(5);
    expect([...out.found].sort()).toEqual(["claude_code_cloud", "conversations", "design_chats", "frames", "projects"]);
    expect(out.ignored).toEqual([]);
  });

  it("never opens private files or artifact contents", async () => {
    const opened = spyOnOpens();
    const files = [...(await fixtureZips("edge-cases")), ...(await decoyZips())];
    const out = await readExport(blobs(files));

    expect([...out.ignored].sort()).toEqual(["artifact_data", "light_metadata", "memories"]);
    for (const name of opened) {
      expect(name).toMatch(/^(conversations\.json|projects\/[^/]+\.json|design_chats\/[^/]+\.json|claude_code_cloud\/routine_runs\.json)$/);
    }
    expect(opened.filter((n) => n.startsWith("projects/"))).toHaveLength(3);
    const serialised = JSON.stringify({ ...out, conversations: null });
    expect(serialised).not.toContain(SENTINEL);
  });

  it("refuses an entry that inflates past the cap, without reading it all", async () => {
    const zip = new JSZip();
    zip.file("projects/huge.json", " ".repeat(MAX_SMALL_FILE_BYTES + 1), { compression: "DEFLATE" });
    const blob = new Blob([new Uint8Array(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }))]);
    await expect(readExport([{ name: "projects-000.zip", blob }])).rejects.toBeInstanceOf(ExportTooBigError);
  });

  it("missing categories: no conversations, null scheduled runs", async () => {
    const zips = (await fixtureZips("edge-cases")).filter((z) => z.name.startsWith("projects"));
    const out = await readExport(blobs(zips));
    expect(out.conversations).toBeNull();
    expect(out.scheduledRuns).toBeNull();
    expect(out.found).toEqual(["projects"]);
  });

  it("accepts a loose conversations.json and reports unusable files", async () => {
    const out = await readExport([
      { name: "conversations.json", blob: new Blob(["[]"]) },
      { name: "users.json", blob: new Blob([SENTINEL]) },
      { name: "holiday.jpg", blob: new Blob(["x"]) },
      { name: "broken.zip", blob: new Blob(["not a zip"]) },
    ]);
    expect(new TextDecoder().decode(out.conversations!)).toBe("[]");
    expect(out.ignored).toEqual(["light_metadata"]);
    expect(out.unreadable).toEqual(["holiday.jpg", "broken.zip"]);
  });
});
