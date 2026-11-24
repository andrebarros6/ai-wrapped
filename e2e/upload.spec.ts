// End-to-end: the browser engine (DuckDB-WASM + the shared SQL) must produce exactly the golden
// outputs the Python CLI produces, without any request leaving our origin.
import { expect, type Page, test } from "@playwright/test";

import { splitStats } from "../lib/engine/stats";
import { decoyZips, FIXTURES, fixtureZips, golden, SENTINEL, TIMEZONES, type ZipFile } from "./fixtures";

const ORIGIN = "http://127.0.0.1:4317";

function trackRequests(page: Page): { url: string; method: string; body: string | null }[] {
  const seen: { url: string; method: string; body: string | null }[] = [];
  page.on("request", (r) => seen.push({ url: r.url(), method: r.method(), body: r.postData() }));
  return seen;
}

/** Open the upload page and wait until React has hydrated (inputs are disabled before that). */
async function open(page: Page) {
  await page.goto("./");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
}

async function setTimezone(page: Page, tz: string) {
  const input = page.getByTestId("tz-input");
  await input.fill(tz);
  await input.press("Enter");
}

async function drop(page: Page, files: ZipFile[]) {
  await page.getByTestId("file-input").setInputFiles(files);
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", /done|error/, { timeout: 60_000 });
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "done");
}

async function sessionStats(page: Page): Promise<Record<string, unknown>> {
  const raw = await page.evaluate(() => sessionStorage.getItem("ai-wrapped:stats"));
  return JSON.parse(raw ?? "null") as Record<string, unknown>;
}

function expected(fixture: string, tz: string) {
  return { version: 1, source: "claude-export", year: 2026, tz, ...splitStats(golden(fixture, tz)).shareable };
}

for (const fixture of FIXTURES) {
  for (const tz of TIMEZONES) {
    test(`browser matches CLI: ${fixture} @ ${tz}`, async ({ page }) => {
      const requests = trackRequests(page);
      await open(page);
      await setTimezone(page, tz);
      await drop(page, await fixtureZips(fixture));

      expect(await sessionStats(page)).toEqual(expected(fixture, tz));

      // Privacy: only GET/HEAD (page loads, prefetch) to our own origin; nothing sent with a body.
      expect(requests.filter((r) => !r.url.startsWith(ORIGIN))).toEqual([]);
      expect(requests.filter((r) => !["GET", "HEAD"].includes(r.method) || r.body)).toEqual([]);
    });
  }
}

test("changing the timezone recomputes without re-dropping", async ({ page }) => {
  await open(page);
  await setTimezone(page, "UTC");
  await drop(page, await fixtureZips("edge-cases"));
  expect(await sessionStats(page)).toEqual(expected("edge-cases", "UTC"));

  await setTimezone(page, "Pacific/Auckland");
  await expect.poll(async () => (await sessionStats(page)).tz).toBe("Pacific/Auckland");
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "done");
  expect(await sessionStats(page)).toEqual(expected("edge-cases", "Pacific/Auckland"));
});

test("a zone typed without Enter is used by an immediate drop", async ({ page }) => {
  await open(page);
  await page.getByTestId("tz-input").fill("Asia/Kolkata");
  await drop(page, await fixtureZips("edge-cases"));
  expect(await sessionStats(page)).toEqual(expected("edge-cases", "Asia/Kolkata"));
});

test("private ZIPs are reported as ignored and never leak", async ({ page }) => {
  const requests = trackRequests(page);
  await open(page);
  await setTimezone(page, "UTC");
  await drop(page, [...(await fixtureZips("edge-cases")), ...(await decoyZips())]);

  await expect(page.getByTestId("ignored-light_metadata")).toContainText("ignored, never opened");
  await expect(page.getByTestId("ignored-memories")).toBeVisible();
  await expect(page.getByTestId("ignored-artifact_data")).toBeVisible();

  const stored = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(stored).not.toContain(SENTINEL);
  for (const title of golden("edge-cases", "UTC").chat_titles as string[]) expect(stored).not.toContain(title);
  expect(requests.filter((r) => !r.url.startsWith(ORIGIN))).toEqual([]);
  expect(await sessionStats(page)).toEqual(expected("edge-cases", "UTC"));
});

test("a drop without conversations explains what's missing", async ({ page }) => {
  await open(page);
  const onlyProjects = (await fixtureZips("edge-cases")).filter((z) => z.name.startsWith("projects"));
  await page.getByTestId("file-input").setInputFiles(onlyProjects);
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "error");
  await expect(page.getByTestId("status").getByRole("alert")).toContainText("conversations-000.zip");
});

test("legal pages are reachable", async ({ page }) => {
  await open(page);
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy policy");
  await page.goto("./terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of use");
});
