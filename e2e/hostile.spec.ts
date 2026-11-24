// Hostile share/compare links: what a stranger could send. Tokens are built raw (as an attacker
// would), bypassing every sanitiser on the way in, so only the decoder and renderer stand guard.
import { expect, type Page, test } from "@playwright/test";
import { deflateSync, strToU8 } from "fflate";

const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const tokenOf = (value: unknown) => b64url(deflateSync(strToU8(typeof value === "string" ? value : JSON.stringify(value))));

const XSS = [
  `<img src=x onerror="window.__pwned=1">`,
  `"><script>window.__pwned=1</script>`,
  `javascript:window.__pwned=1`,
  `<svg onload="window.__pwned=1">`,
  `{{constructor.constructor('window.__pwned=1')()}}`,
];

const baseStats = { chats: 12, your_messages: 80, active_days: 9, longest_streak_days: 3, by_hour: { "9": 50, "22": 30 } };

/** Watch for anything executing that shouldn't, and for CSP violations. */
async function arm(page: Page) {
  const problems: string[] = [];
  page.on("dialog", (d) => {
    problems.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(`csp: ${m.text().slice(0, 160)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
  return problems;
}

async function walkStory(page: Page) {
  await page.getByTestId("play-pause").click();
  const counter = page.getByTestId("card-counter");
  const total = Number((await counter.textContent())!.split("/")[1]);
  for (let i = 1; i < total; i++) await page.keyboard.press("ArrowRight");
  await page.getByTestId("query-toggle").click();
}

for (const payload of XSS) {
  test(`XSS payload stays text: ${payload.slice(0, 30)}`, async ({ page }) => {
    const problems = await arm(page);
    const token = tokenOf({
      v: 1,
      s: { ...baseStats, club: payload, chattiest_day: { date: "2026-02-25", messages: 3, topics: 1 } },
      e: {
        display_name: payload,
        tag: payload,
        opener: payload,
        prediction: [payload, payload, payload],
        chattiest_day_example: payload,
        theme: payload,
      },
    });
    await page.goto(`./s#${token}`);
    await expect(page.getByTestId("story-card")).toBeVisible();
    await walkStory(page);
    await page.goto(`./vs#${token}.${token}`);
    await expect(page.getByTestId("compare")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(problems).toEqual([]);
  });
}

test("prototype pollution keys do nothing", async ({ page }) => {
  const problems = await arm(page);
  const raw = `{"v":1,"s":{"chats":5,"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}}},"e":{"__proto__":{"isAdmin":true},"opener":"hi"}}`;
  await page.goto(`./s#${tokenOf(raw)}`);
  await expect(page.getByTestId("story-card")).toBeVisible();
  expect(await page.evaluate(() => ({}) as Record<string, unknown>)).toEqual({});
  expect(await page.evaluate(() => (Object.prototype as Record<string, unknown>).polluted)).toBeUndefined();
  expect(problems).toEqual([]);
});

test("extreme and wrong-typed numbers render without breaking", async ({ page }) => {
  const problems = await arm(page);
  // Big but under the 8,000-character link cap (bigger links are refused, tested below).
  const byHour = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [String(i), 1e9]));
  const token = tokenOf({
    v: 1,
    s: { chats: 1e308, your_messages: -5, active_days: "lots", retries: Number.MAX_SAFE_INTEGER, night_share: 99, by_hour: byHour },
    e: {},
  });
  const t0 = Date.now();
  await page.goto(`./s#${token}`);
  await expect(page.getByTestId("story-card")).toBeVisible();
  await walkStory(page);
  expect(Date.now() - t0).toBeLessThan(15_000);
  expect(problems).toEqual([]);
});

test("oversized tokens, bombs, junk and deep nesting are refused politely", async ({ page }) => {
  const problems = await arm(page);
  const deep = "[".repeat(50_000) + "]".repeat(50_000);
  for (const token of [
    "A".repeat(8_001),
    tokenOf({ v: 1, s: { pad: "x".repeat(5_000_000) }, e: {} }),
    "%%%not-base64%%%",
    tokenOf(deep),
    tokenOf("null"),
  ]) {
    await page.goto(`./s#${encodeURI(token)}`);
    await expect(page.getByTestId("broken-link")).toBeVisible();
  }
  await page.goto(`./vs#${"A".repeat(30)}.${"B".repeat(30)}`);
  await expect(page.getByTestId("broken-link")).toBeVisible();
  expect(problems).toEqual([]);
});

test("layout breakers stay inside the cards and the compare table", async ({ page }) => {
  const problems = await arm(page);
  const long = "W".repeat(140);
  const token = tokenOf({
    v: 1,
    s: { ...baseStats, chattiest_day: { date: "2026-02-25", messages: 3, topics: 1 } },
    e: {
      display_name: "‮evil​" + "W".repeat(32),
      tag: "x".repeat(24),
      opener: long,
      prediction: ["M".repeat(60), "M".repeat(60), "M".repeat(60)],
      chattiest_day_example: "W".repeat(90),
    },
  });
  await page.goto(`./s#${token}`);
  await page.getByTestId("play-pause").click();
  const card = page.getByTestId("story-card");
  const total = Number((await page.getByTestId("card-counter").textContent())!.split("/")[1]);
  for (let i = 0; i < total; i++) {
    // No text may overflow its box (an unbroken word would run off the card and be clipped).
    const overflow = await card.evaluate((el) => {
      const frame = el.querySelector("div[style*='1080px']") ?? el;
      return [frame, ...frame.querySelectorAll("span, div")].filter(
        (n) => n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 1,
      ).length;
    });
    expect(overflow, `card ${i + 1} has content past its right edge`).toBe(0);
    // ...or so much text that it spills over the header and footer.
    const spill = await card.evaluate((el) => {
      const body = el.querySelector("[data-card-body]") as HTMLElement;
      return body.scrollHeight - body.clientHeight;
    });
    expect(spill, `card ${i + 1} text is taller than the card`).toBeLessThanOrEqual(1);
    await page.keyboard.press("ArrowRight");
  }
  // Bidi overrides are stripped, so nothing on the card can be shown reversed.
  expect(await card.textContent()).not.toContain(String.fromCodePoint(0x202e));
  await page.goto(`./vs#${token}.${token}`);
  expect(await page.locator("body").textContent()).not.toContain(String.fromCodePoint(0x202e));
  const wider = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(wider, "compare page scrolls sideways").toBe(false);
  expect(problems).toEqual([]);
});
