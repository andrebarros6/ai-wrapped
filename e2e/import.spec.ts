// The prompt kit: paste JSON from your own Claude (or the CLI) and get the same story.
import { expect, type Page, test } from "@playwright/test";

import { golden } from "./fixtures";

const LITE = {
  version: 1,
  source: "lite-prompt",
  platform: "Claude",
  chats: 140,
  your_messages: 900,
  active_days: 80,
  web_searches: 60,
  projects_total: 4,
  night_share: 0.2,
  languages: 3,
  club: "Builders",
  opener: "A year of side projects and late fixes.",
  prediction: ["Ship one more thing.", "Sleep a bit more.", "Say thanks twice as often."],
};

async function importJson(page: Page, json: string) {
  await page.goto("./import");
  await page.getByTestId("import-input").fill(json);
  await page.getByTestId("import-submit").click();
}

test("CLI / full-kit JSON gives the full 8-card story with exact numbers", async ({ page }) => {
  const full = golden("edge-cases", "Europe/Lisbon") as Record<string, unknown> & { chats: number; chat_titles: string[] };
  const cli = { version: 1, source: "cli", year: 2026, tz: "Europe/Lisbon", ...full }; // what the CLI prints
  await importJson(page, "```json\n" + JSON.stringify(cli, null, 1) + "\n```");
  await expect(page.getByTestId("story-card")).toBeVisible();
  await page.getByTestId("play-pause").click();
  await expect(page.getByTestId("card-counter")).toHaveText("1 / 8");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("story-card")).toContainText(`${full.chats}chats started`);
  await expect(page.getByTestId("story-card")).not.toContainText("ESTIMATED");

  const stored = await page.evaluate(() => sessionStorage.getItem("ai-wrapped:stats") ?? "");
  expect(JSON.parse(stored)).toMatchObject({ source: "cli", tz: "Europe/Lisbon", chats: full.chats });
  for (const t of full.chat_titles) expect(stored).not.toContain(t);
});

test("lite JSON gives five estimated cards and uses its own words", async ({ page }) => {
  await importJson(page, JSON.stringify(LITE));
  await expect(page.getByTestId("story-card")).toBeVisible();
  await page.getByTestId("play-pause").click();
  await expect(page.getByTestId("card-counter")).toHaveText("1 / 5");
  await expect(page.getByTestId("story-card")).toContainText("AI WRAPPED 2026 · ESTIMATED");
  await expect(page.getByTestId("story-card")).toContainText(LITE.opener);
  await page.keyboard.press("End");
  await expect(page.getByTestId("story-card")).toContainText("Sleep a bit more.");
});

test("a new import replaces the previous story's edits", async ({ page }) => {
  await importJson(page, JSON.stringify(LITE));
  await page.getByTestId("play-pause").click();
  await page.getByTestId("edit-toggle").click();
  await page.getByTestId("opener-input").fill("Old opener from another story.");

  const full = golden("sample-export", "UTC");
  await importJson(page, JSON.stringify(full));
  await page.getByTestId("play-pause").click();
  await expect(page.getByTestId("story-card")).not.toContainText("Old opener from another story.");
  await expect(page.getByTestId("story-card")).toContainText(`${full.chats as number} chats over`);
});

test("explains what's wrong with a bad paste", async ({ page }) => {
  await importJson(page, "Sorry, I can't access your past chats.");
  await expect(page.getByTestId("import-error")).toContainText("No JSON found");
  await page.getByTestId("import-input").fill('{"hello": "world"}');
  await page.getByTestId("import-submit").click();
  await expect(page.getByTestId("import-error")).toContainText("isn't the prompt's JSON");
});

test("copy buttons copy the right prompt", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./import");
  await page.getByTestId("copy-prompt").click();
  await expect(page.getByTestId("copy-prompt")).toHaveText("Copied ✓");
  const full = await page.evaluate(() => navigator.clipboard.readText());
  expect(full).toContain('TZ_NAME = "YOUR/TIMEZONE"');
  expect(full).toContain("Don't open, read or summarise my chats yourself.");

  await page.getByTestId("kit-lite").click();
  await page.getByTestId("copy-prompt").click();
  const lite = await page.evaluate(() => navigator.clipboard.readText());
  expect(lite).toContain('"source": "lite-prompt"');
});

test("the landing page links to the prompt kit", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Open the prompt kit →" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Do it in your own Claude.");
});
