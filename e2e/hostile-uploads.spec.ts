// Hostile uploads and pastes: the page must fail clearly, never hang, crash or show raw internals.
import { expect, type Page, test } from "@playwright/test";
import { strToU8, Zip, ZipDeflate } from "fflate";
import JSZip from "jszip";

import { fixtureZips, type ZipFile } from "./fixtures";

/** A ZIP of ~1 MB whose conversations.json inflates to `mb` megabytes of spaces. */
function bombZip(mb: number): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((err, data, final) => {
      if (err) return reject(err);
      chunks.push(data);
      if (final) resolve({ name: "conversations-000.zip", mimeType: "application/zip", buffer: Buffer.concat(chunks) });
    });
    const file = new ZipDeflate("conversations.json", { level: 9 });
    zip.add(file);
    const block = new Uint8Array(1 << 20).fill(0x20);
    file.push(strToU8("["));
    for (let i = 0; i < mb; i++) file.push(block);
    file.push(strToU8("]"), true);
    zip.end();
  });
}

async function zipOf(name: string, entries: Record<string, string>): Promise<ZipFile> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  return { name, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
}

async function drop(page: Page, files: ZipFile[]) {
  await page.goto("./");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.getByTestId("file-input").setInputFiles(files);
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", /done|error/, { timeout: 90_000 });
}

const alertText = (page: Page) => page.getByTestId("status").getByRole("alert").textContent();

test("a ZIP bomb is refused with a clear message, and the page survives @heavy", async ({ page }) => {
  test.setTimeout(180_000);
  const bomb = await bombZip(1024);
  expect(bomb.buffer.length).toBeLessThan(3_000_000);
  await drop(page, [bomb]);
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "error");
  expect(await alertText(page)).toMatch(/too big|CLI/i);
  // Still usable afterwards: a real export works in the same tab.
  await page.getByTestId("file-input").setInputFiles(await fixtureZips("sample-export"));
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "done", { timeout: 60_000 });
});

for (const [label, json] of [
  ["broken JSON", '[{"uuid": "x", "chat_messages": ['],
  ["an object instead of a list", '{"conversations": []}'],
  ["wrong field types", '[{"uuid": 1, "name": 2, "created_at": "yesterday", "chat_messages": "lots"}]'],
  ["empty file", ""],
] as const) {
  test(`malformed conversations.json (${label}) gets a friendly error`, async ({ page }) => {
    await drop(page, [await zipOf("conversations-000.zip", { "conversations.json": json })]);
    await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "error");
    const text = (await alertText(page)) ?? "";
    expect(text).toMatch(/doesn't look like a Claude export|couldn't read/i);
    expect(text).not.toMatch(/Error:|Exception|Parser|Binder|duckdb|\bat\b .*\.js/i);
  });
}

test("a file that only pretends to be a ZIP", async ({ page }) => {
  await drop(page, [{ name: "conversations-000.zip", mimeType: "application/zip", buffer: Buffer.from("not a zip at all") }]);
  expect(await alertText(page)).toMatch(/couldn't find conversations\.json/i);
});

test("a ZIP with 10,000 entries is handled quickly", async ({ page }) => {
  const entries: Record<string, string> = {};
  for (let i = 0; i < 10_000; i++) entries[`projects/p${i}.json`] = JSON.stringify({ created_at: "2026-03-01T10:00:00Z" });
  const many = await zipOf("projects-000.zip", entries);
  const t0 = Date.now();
  await drop(page, [...(await fixtureZips("sample-export")).filter((z) => z.name.startsWith("conversations")), many]);
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "done");
  expect(Date.now() - t0).toBeLessThan(45_000);
});

test("hostile pastes in /import stay text and fail cleanly", async ({ page }) => {
  const problems: string[] = [];
  page.on("dialog", (d) => {
    problems.push(d.message());
    void d.dismiss();
  });
  await page.goto("./import");
  const lite = {
    version: 1,
    source: "lite-prompt",
    chats: 10,
    opener: `<img src=x onerror="window.__pwned=1">`,
    prediction: [`<script>window.__pwned=1</script>`],
    __proto__: { polluted: 1 },
  };
  await page.getByTestId("import-input").fill(JSON.stringify(lite).replace('"__proto__"', '"__proto__"'));
  await page.getByTestId("import-submit").click();
  await expect(page.getByTestId("story-card")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await page.evaluate(() => (Object.prototype as Record<string, unknown>).polluted)).toBeUndefined();
  await page.goto("./import");
  await page.getByTestId("import-input").fill("{" + " ".repeat(400_000) + "}");
  await page.getByTestId("import-submit").click();
  await expect(page.getByTestId("import-error")).toContainText("too long");
  expect(problems).toEqual([]);
});
