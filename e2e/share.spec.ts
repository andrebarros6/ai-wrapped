// Sharing: PNGs made in the browser, links whose stats never reach a server, and compare.
import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";
import JSZip from "jszip";

import { encodeShare } from "../lib/share/codec";
import { DEMO_EDITS, DEMO_STATS } from "../lib/story/demo";
import { fixtureZips, golden } from "./fixtures";

const ORIGIN = "http://127.0.0.1:4317";

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer | Uint8Array): { w: number; h: number } {
  const b = Buffer.from(buf);
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

async function ownStory(page: Page) {
  await page.goto("./");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.getByTestId("tz-input").fill("UTC");
  await page.getByTestId("tz-input").press("Enter");
  await page.getByTestId("file-input").setInputFiles(await fixtureZips("edge-cases"));
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "done", { timeout: 60_000 });
  await page.getByTestId("see-story").click();
  await page.getByTestId("play-pause").click();
  await page.getByTestId("share-toggle").click();
}

test("downloads one card as a 1080×1350 PNG made in the browser", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
  await ownStory(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-card").click()]);
  expect(download.suggestedFilename()).toBe("ai-wrapped-2026-1-opener.png");
  const file = readFileSync((await download.path())!);
  expect(pngSize(file)).toEqual({ w: 1080, h: 1350 });
  expect(file.length).toBeGreaterThan(20_000);
  expect(requests.filter((r) => !r.split(" ")[1].startsWith(ORIGIN))).toEqual([]);
  expect(requests.filter((r) => !/^(GET|HEAD) /.test(r))).toEqual([]);
});

test("downloads all eight cards as a ZIP", async ({ page }) => {
  await ownStory(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-all").click()]);
  expect(download.suggestedFilename()).toBe("ai-wrapped-2026.zip");
  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const names = Object.keys(zip.files).sort();
  expect(names).toHaveLength(8);
  expect(names[0]).toBe("ai-wrapped-2026-1-opener.png");
  for (const n of names) expect(pngSize(await zip.file(n)!.async("uint8array"))).toEqual({ w: 1080, h: 1350 });
});

test("share link opens the same story, and its stats never reach a server", async ({ page, context }) => {
  await ownStory(page);
  await page.getByTestId("share-panel").waitFor();
  const link = await page.getByTestId("share-url").inputValue();
  const token = link.split("#")[1];
  expect(link).toMatch(/\/wrapped\/s#[A-Za-z0-9_-]+$/);
  expect(token.length).toBeLessThan(2_000);

  const other = await context.newPage();
  const requests: string[] = [];
  other.on("request", (r) => requests.push(r.url()));
  await other.goto(link);
  await expect(other.getByTestId("shared-banner")).toBeVisible();
  await other.getByTestId("play-pause").click();
  await other.keyboard.press("ArrowRight");
  const chats = (golden("edge-cases", "UTC") as { chats: number }).chats;
  await expect(other.getByTestId("story-card")).toContainText(`${chats}chats started`);

  // Read-only: no editing or sharing someone else's story.
  await expect(other.getByTestId("edit-toggle")).toHaveCount(0);
  await expect(other.getByTestId("share-toggle")).toHaveCount(0);
  // The fragment is never part of a request.
  expect(requests.some((u) => u.includes(token.slice(0, 40)))).toBe(false);
  expect(requests.filter((u) => !u.startsWith(ORIGIN))).toEqual([]);
});

test("compare a friend's link with yours", async ({ page }) => {
  await ownStory(page);
  const friend = `https://www.barrosbuilds.com/wrapped/s#${encodeShare(DEMO_STATS, DEMO_EDITS)}`;
  await page.getByTestId("friend-link").fill(friend);
  await page.getByTestId("compare").click();
  await expect(page.getByTestId("compare")).toBeVisible();
  // The demo (André) has far more chats than the edge-case fixture.
  await expect(page.getByTestId("duel-chats")).toHaveAttribute("data-winner", "a");
  await expect(page.getByTestId("compare-verdict")).toContainText("André wins");
});

test("compare with mine from someone's shared story", async ({ page }) => {
  await ownStory(page);
  await page.goto(`./s#${encodeShare(DEMO_STATS, DEMO_EDITS)}`);
  await page.getByTestId("compare-with-mine").click();
  await expect(page.getByTestId("compare-verdict")).toBeVisible();
  await expect(page.getByTestId("duel-chats")).toHaveAttribute("data-winner", "a");
});

test("broken links explain themselves", async ({ page }) => {
  await page.goto("./s#not-a-real-token");
  await expect(page.getByTestId("broken-link")).toBeVisible();
  await page.goto("./vs#abc.def");
  await expect(page.getByTestId("broken-link")).toBeVisible();
});
