// When parts of the app fail to load (flaky network, blocked files, old proxies), people must get
// a clear message within a reasonable time, never an endless spinner.
import { expect, type Page, test } from "@playwright/test";

import { fixtureZips } from "./fixtures";

async function dropAndWait(page: Page) {
  await page.goto("./");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.getByTestId("file-input").setInputFiles(await fixtureZips("sample-export"));
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", /done|error/, { timeout: 45_000 });
}

for (const [label, pattern] of [
  ["the DuckDB WASM file", "**/duckdb-eh.wasm"],
  ["the DuckDB worker", "**/duckdb-browser-eh.worker.js"],
  ["the DuckDB extensions", "**/*.duckdb_extension.wasm"],
] as const) {
  test(`if ${label} can't load, the page says so instead of hanging`, async ({ page }) => {
    await page.route(pattern, (route) => route.abort("failed"));
    await dropAndWait(page);
    await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "error");
    await expect(page.getByTestId("status").getByRole("alert")).toContainText(/couldn't load|connection/i);
  });
}

test("after a failed load, trying again works once the network is back", async ({ page }) => {
  let block = true;
  await page.route("**/duckdb-eh.wasm", (route) => (block ? route.abort("failed") : route.continue()));
  await dropAndWait(page);
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "error");
  block = false;
  await page.getByTestId("file-input").setInputFiles(await fixtureZips("sample-export"));
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "done", { timeout: 45_000 });
});

test("a story link still opens when the database files are unreachable (stories don't need them)", async ({ page }) => {
  await page.route("**/duckdb/**", (route) => route.abort("failed"));
  await page.goto("./story#demo");
  await expect(page.getByTestId("story-card")).toBeVisible();
});
