import { defineConfig, devices } from "@playwright/test";

import base from "./playwright.config";

// The core flows in Firefox and WebKit (Safari's engine):  npx playwright test -c playwright.browsers.config.ts
export default defineConfig({
  ...base,
  grep: /browser matches CLI: edge-cases @ Europe\/Lisbon|navigate all 8 cards|downloads one card|share link opens|XSS payload stays text: <img|ZIP bomb|DuckDB WASM file/,
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
