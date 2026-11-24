// The story viewer: real export → story, navigation, themes, edits, "show the query", privacy.
import { expect, type Page, test } from "@playwright/test";

import { fixtureZips, golden, isLocal } from "./fixtures";


async function analyse(page: Page, tz = "UTC") {
  await page.goto("./");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.getByTestId("tz-input").fill(tz);
  await page.getByTestId("tz-input").press("Enter");
  await page.getByTestId("file-input").setInputFiles(await fixtureZips("edge-cases"));
  await expect(page.getByTestId("status")).toHaveAttribute("data-phase", "done", { timeout: 60_000 });
}

async function openStory(page: Page) {
  await page.getByTestId("see-story").click();
  await expect(page.getByTestId("story-card")).toBeVisible();
  await page.getByTestId("play-pause").click(); // hold still while we look
}

const card = (page: Page) => page.getByTestId("story-card");

test("export → story: navigate all 8 cards with the keyboard", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await analyse(page);
  await openStory(page);

  await expect(card(page)).toContainText("1 / 8");
  for (let i = 2; i <= 8; i++) {
    await page.keyboard.press("ArrowRight");
    await expect(card(page)).toContainText(`${i} / 8`);
  }
  await page.keyboard.press("ArrowRight"); // stays on the last card
  await expect(page.getByTestId("card-counter")).toHaveText("8 / 8");
  await page.keyboard.press("Home");
  await expect(page.getByTestId("card-counter")).toHaveText("1 / 8");

  expect(requests.filter((u) => !isLocal(u))).toEqual([]);
});

test("cards show this export's numbers", async ({ page }) => {
  await analyse(page, "UTC");
  await openStory(page);
  const g = golden("edge-cases", "UTC") as { chats: number; your_messages: number; retries: number; club: string };

  await page.keyboard.press("ArrowRight");
  await expect(card(page)).toContainText(`${g.chats}chats started`);
  await expect(card(page)).toContainText(`${g.your_messages}messages sent`);
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await expect(card(page)).toContainText(`${g.retries}times you made Claude try again`);
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(card(page)).toContainText(`${g.club} Club`);
});

test("tap right goes forward, tap left goes back", async ({ page }) => {
  await analyse(page);
  await openStory(page);
  const box = (await card(page).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
  await expect(page.getByTestId("card-counter")).toHaveText("2 / 8");
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height / 2);
  await expect(page.getByTestId("card-counter")).toHaveText("1 / 8");
});

test("auto-advances when playing", async ({ page }) => {
  await analyse(page);
  await page.getByTestId("see-story").click();
  await expect(page.getByTestId("card-counter")).toHaveText("2 / 8", { timeout: 9_000 });
});

test("titles stay hidden until opted in, then only on this device", async ({ page }) => {
  await analyse(page);
  await openStory(page);
  const titles = golden("edge-cases", "UTC").chattiest_day_titles as string[];
  expect(titles.length).toBeGreaterThan(0);

  for (const t of titles) await expect(page.getByText(t)).toHaveCount(0);

  await page.getByTestId("edit-toggle").click();
  await expect(page.getByTestId("title-suggestions")).toHaveCount(0); // off by default
  await page.getByTestId("suggest-toggle").check();
  const suggestion = page.getByTestId("title-suggestions").getByRole("button", { name: titles[0] });
  await suggestion.click();
  await expect(page.getByTestId("example-input")).toHaveValue(titles[0]);

  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight"); // focus is on a button: arrows still work
  await expect(card(page)).toContainText("4 / 8");
  await expect(card(page)).toContainText(titles[0]);

  // Titles never reach storage, even after being chosen as text: only the edited line does.
  const stats = await page.evaluate(() => sessionStorage.getItem("ai-wrapped:stats"));
  for (const t of titles) expect(stats).not.toContain(t);
});

test("edits show on the cards, survive a reload, and the tag is cleaned", async ({ page }) => {
  await analyse(page);
  await openStory(page);
  await page.getByTestId("edit-toggle").click();
  await page.getByTestId("tag-input").pressSequentially("#Lisbon Builders!"); // typed, key by key
  await expect(page.getByTestId("tag-input")).toHaveValue("lisbon-builders-");
  await page.getByTestId("opener-input").fill("A year of tiny experiments.");
  await expect(card(page)).toContainText("A year of tiny experiments.");
  await expect(card(page)).toContainText("barrosbuilds.com/wrapped · #lisbon-builders");

  await page.reload();
  await expect(card(page)).toContainText("A year of tiny experiments.");
});

test("theme toggle switches to the dark theme", async ({ page }) => {
  await analyse(page);
  await openStory(page);
  const bg = () => card(page).locator("div").nth(2).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg()).toBe("rgb(28, 26, 23)");
  await page.getByTestId("theme-toggle").click();
  expect(await bg()).toBe("rgb(14, 15, 19)");
});

test("show the query reveals the SQL behind the card", async ({ page }) => {
  await analyse(page);
  await openStory(page);
  await page.keyboard.press("ArrowRight");
  await page.getByTestId("query-toggle").click();
  await expect(page.getByTestId("query-panel")).toContainText("sql/metrics/10_volume.sql");
  await expect(page.getByTestId("query-panel")).toContainText("'your_messages'");
});

test("demo and empty states", async ({ page }) => {
  await page.goto("./story");
  await expect(page.getByTestId("story-empty")).toBeVisible();
  await page.getByRole("link", { name: "See the demo →" }).click();
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expect(card(page)).toContainText("Three countries, four languages");
});
