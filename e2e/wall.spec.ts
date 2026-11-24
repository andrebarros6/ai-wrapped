// The Wall: empty state, joining via a prefilled GitHub PR, eligibility.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { fixtureZips, golden, ROOT } from "./fixtures";

const PYTHON = process.platform === "win32" ? "python" : "python3";

function pythonValidate(entry: unknown): string {
  const code = `import json, sys\nsys.path.insert(0, ${JSON.stringify(join(ROOT, "scripts"))})\nimport wall\ntry:\n    wall.validate_entry(json.load(sys.stdin)); print("ok")\nexcept wall.EntryError as e:\n    print(e)`;
  return execFileSync(PYTHON, ["-c", code], {
    input: JSON.stringify(entry),
    encoding: "utf8",
    env: { ...process.env, PYTHONUTF8: "1" },
  }).trim();
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
  await page.getByTestId("wall-toggle").click();
}

test("the empty Wall invites people in", async ({ page }) => {
  await page.goto("./wall");
  await expect(page.getByTestId("wall-empty")).toBeVisible();
  await page.goto("./wall/everyone");
  await expect(page.getByTestId("tag-title")).toHaveText("Everyone");
});

test("join: a prefilled GitHub pull request with a valid entry and no titles", async ({ page }) => {
  await ownStory(page);
  await expect(page.getByTestId("ranks-locked")).toContainText("Ranks unlock when 20 people");

  const open = page.getByTestId("wall-open-pr");
  await expect(open).toHaveAttribute("aria-disabled", "true");
  await page.getByTestId("wall-name").fill("Ana Silva");
  await page.getByTestId("wall-tag").pressSequentially("Lisbon Builders");
  await expect(open).toHaveAttribute("aria-disabled", "true"); // consent first
  await page.getByTestId("wall-consent").check();
  await expect(open).toHaveAttribute("aria-disabled", "false");

  const url = new URL((await open.getAttribute("href"))!);
  expect(url.origin + url.pathname).toBe("https://github.com/andrebarros6/ai-wrapped/new/main");
  expect(url.searchParams.get("filename")).toMatch(/^wall\/entries\/ana-silva-[a-f0-9]{6}\.json$/);
  const entry = JSON.parse(url.searchParams.get("value")!);
  expect(entry).toMatchObject({ display_name: "Ana Silva", tag: "lisbon-builders", source: "claude-export" });
  expect(pythonValidate(entry)).toBe("ok");
  for (const t of golden("edge-cases", "UTC").chat_titles as string[]) expect(JSON.stringify(entry)).not.toContain(t);

  // What's previewed is exactly what's published.
  expect(JSON.parse(await page.getByTestId("wall-preview").textContent() ?? "")).toEqual(entry);
});

test("a name that isn't allowed keeps the button disabled", async ({ page }) => {
  await ownStory(page);
  await page.getByTestId("wall-name").fill("see https://spam.example");
  await page.getByTestId("wall-consent").check();
  await expect(page.getByTestId("wall-open-pr")).toHaveAttribute("aria-disabled", "true");
});

test("estimates and the demo can't join", async ({ page }) => {
  await page.goto("./import");
  await page.getByTestId("import-input").fill(JSON.stringify({ version: 1, source: "lite-prompt", chats: 50 }));
  await page.getByTestId("import-submit").click();
  await page.getByTestId("play-pause").click();
  await page.getByTestId("wall-toggle").click();
  await expect(page.getByTestId("wall-not-eligible")).toBeVisible();

  await page.goto("./story#demo");
  await page.getByTestId("play-pause").click();
  await page.getByTestId("wall-toggle").click();
  await expect(page.getByTestId("wall-panel")).toContainText("Make your own story to join the Wall.");
  await expect(page.getByTestId("wall-open-pr")).toHaveCount(0);
});
