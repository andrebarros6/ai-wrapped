// End-to-end smoke test of a deployed site, with synthetic data only.
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { fixtureZips, golden } from "./fixtures";

test("live: export → story → PNG, nothing leaves the site", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: { url: string; method: string }[] = [];
  page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));

  const res = await page.goto("./");
  expect(res?.status()).toBe(200);
  expect(res?.headers()["content-security-policy"]).toContain("connect-src 'self'");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.getByTestId("tz-input").fill("Europe/Lisbon");
  await page.getByTestId("tz-input").press("Enter");
  await page.getByTestId("file-input").setInputFiles(await fixtureZips("edge-cases"));
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "done", { timeout: 90_000 });

  const stats = JSON.parse((await page.evaluate(() => sessionStorage.getItem("ai-wrapped:stats")))!);
  const g = golden("edge-cases", "Europe/Lisbon") as Record<string, unknown>;
  for (const k of ["chats", "your_messages", "by_hour", "club", "retries", "thanks"]) expect(stats[k]).toEqual(g[k]);

  await page.getByTestId("see-story").click();
  await page.getByTestId("play-pause").click();
  await page.getByTestId("share-toggle").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-card").click()]);
  const png = readFileSync((await download.path())!);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1350]);

  const offsite = requests.filter((r) => new URL(r.url).origin !== origin);
  expect(offsite).toEqual([]);
  expect(requests.filter((r) => !["GET", "HEAD"].includes(r.method) && !r.url.includes("/_vercel/insights/"))).toEqual([]);
  console.log(`requests: ${requests.length}, all to ${origin}; methods: ${[...new Set(requests.map((r) => r.method))].join(",")}`);
});
