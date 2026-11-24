// Test helpers shared by Vitest and Playwright: zip fixture folders the way Claude's export
// does (one ZIP per category, files at the ZIP root) and load the golden outputs.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import JSZip from "jszip";

export const ROOT = join(__dirname, "..");
export const FIXTURES = ["sample-export", "edge-cases"] as const;
export const TIMEZONES = ["UTC", "Europe/Lisbon", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Auckland"];
export const SENTINEL = "SENTINEL-PRIVATE-DO-NOT-READ@example.invalid";

export interface ZipFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

async function zipFolder(folder: string, name: string): Promise<ZipFile> {
  const zip = new JSZip();
  for (const file of walk(folder)) zip.file(relative(folder, file).replace(/\\/g, "/"), readFileSync(file));
  return { name, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
}

async function zipEntries(name: string, entries: Record<string, string>): Promise<ZipFile> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  return { name, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
}

/** One ZIP per category folder of a fixture, e.g. conversations-000.zip. */
export async function fixtureZips(fixture: string): Promise<ZipFile[]> {
  const base = join(ROOT, "fixtures", fixture);
  return Promise.all(readdirSync(base).map((d) => zipFolder(join(base, d), `${d}.zip`)));
}

/** ZIPs that must never be opened, each carrying a sentinel string. */
export async function decoyZips(): Promise<ZipFile[]> {
  const secret = JSON.stringify({ email: SENTINEL, ip: "203.0.113.7" });
  return Promise.all([
    zipEntries("light_metadata-000.zip", { "users.json": secret, "login_history.json": secret }),
    zipEntries("memories-000.zip", { "memories/m1.json": secret }),
    zipEntries("artifact_data-000.zip", { "artifacts/a1/data/documents.json": secret }),
  ]);
}

export function golden(fixture: string, tz: string): Record<string, unknown> {
  const file = join(ROOT, "fixtures", "expected", `${fixture}__${tz.replace(/\//g, "-")}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}
