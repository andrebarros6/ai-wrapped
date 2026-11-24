# AI Wrapped — build plan (local-first, v1)

## Context
The project started from a brief that contained:
- the brief `CLAUDE.md`, plus `docs/SPEC.md` and `docs/DATA.md`
- 16 card designs in `design/`
- the reference script `scripts/wrapped.py`
- prompts
- a synthetic fixture with 40 chats

Real exports include `light_metadata` (email, phone, IPs) and must never enter the repo; keep them outside the repo folder.

The original brief used Supabase, a server route for OG images, and analytics events. You've changed direction:
- **Privacy first:** no database, no accounts, nothing stored.
- **Less to run in production.**
- **Still a strong data-engineering and visualisation piece.**

### Decisions
- **Shape:** a local-first static app. DuckDB-WASM runs the metrics as SQL in the visitor's browser, and the same `.sql` files power the Python CLI. There is no backend.
- **Prompt kit:** for people who don't want to use the site's upload flow. The prompt runs in their own Claude account and returns stats JSON, which the site turns into the same cards.
- **Compare:** stats travel in the URL **fragment** (`#…`). Browsers never send it to any server.
- **Wall:** GitHub pull requests to `wall/entries/`, validated by a GitHub Action. Leaderboards are built as static files, and the entries form an open dataset.
- **Analytics:** cookieless Vercel page views only, with no custom events.
- **URL:** `https://www.barrosbuilds.com/wrapped`. This is a separate repo and Vercel project with `basePath: '/wrapped'`. The main site rewrites to it.
  - Verified on 2026-11-24: the main site is Next.js 16.1.6 on Vercel, repo `andrebarros6/barrosbuilds`, app in `homepage/`.
  - The apex domain redirects (308) to www and keeps the path. `/wrapped` currently returns 404, so it's free. There are no rewrites yet.
  - Preview URLs sit behind Vercel SSO, so the rewrite must target the Wrapped project's production domain.
- **Repo:** private on GitHub until launch.
- **Anchor docs:** `CLAUDE.md` + `SPEC.md` serve as the spec and PRD. Both get updated to this architecture, and this plan is saved as `docs/PLAN.md`.

### Data flow
```
ZIPs ─► JSZip (browser, Web Worker) ─► DuckDB-WASM tables: chats, messages, blocks
                                         │  sql/metrics/*.sql  (same files ◄── Python CLI via duckdb)
                                         ▼
                                   WrappedStats JSON ─► cards (SVG/HTML) ─► PNG (in browser)
                                         │                     └─► #fragment share / compare
                                         └─► (opt-in) GitHub PR ─► Action ─► static leaderboards + open dataset
```
Nothing goes to a server except the static site files and cookieless page views. A visitor's stats reach GitHub only if they open a pull request themselves.

---

## Step 0: Repo setup
1. Flatten the unzipped brief into the repo root. ✅
2. `git init -b main`. Add a `.gitignore` for node_modules, .next, out, .env*, coverage, *.zip, and defensively `**/light_metadata*` and `**/export/`. Add an MIT `LICENSE`.
3. Commits:
   - (a) Import brief, designs, script, fixture.
   - (b) Rewrite `CLAUDE.md`, `SPEC.md`, `DATA.md` and `README.md` for the local-first architecture and the barrosbuilds.com/wrapped URL. Remove Supabase, OG routes and events. Add `docs/PLAN.md`.
   - (c) GitHub Action `guard-private-data` that fails on any path matching `light_metadata`, `users.json` or `login_history.json`.
4. `gh repo create andrebarros6/ai-wrapped --private --source . --push`.

## Step 1: Spike, go/no-go (about half a day; nothing ships)
Prove the risky parts in a throwaway page before committing to the architecture:
- DuckDB-WASM loads in a Web Worker. `read_json` handles a ~100 MB `conversations.json` (your real export, run locally only), including unnesting `chat_messages` and `content`.
- The **ICU extension** works in WASM, so `ts AT TIME ZONE 'Europe/Lisbon'` gives the correct hour, weekday and date.
- Memory and time on a mid-range phone. Bundle size, given that DuckDB is loaded only after the drop.

**Fallbacks:**
- ICU doesn't work in WASM → compute local-time columns in JS with `Intl` before loading the data.
- JSON loading is too heavy → stream-parse in JS into Arrow or Parquet, then hand that to DuckDB.

### Results (2026-11-24): GO ✅
Tested in headless Chromium with DuckDB-WASM 1.33 (engine v1.5.4), the `eh` bundle, on a real heavy-user export: 62 MB `conversations.json`, 14.5 MB zipped, 405 chats in 2026, 3,381 messages, 12,108 content blocks. Only aggregates were inspected.

| Measure | Desktop | CPU throttled 4× | 6× |
|---|---|---|---|
| DuckDB instantiate | 1.2 s | 1.3 s | 1.9 s |
| Unzip (JSZip) | 0.9 s | 3.9 s | 5.0 s |
| Load ICU + set timezone | 0.5 s | 0.7 s | 0.6 s |
| `read_json` (typed) | 0.7 s | 1.1 s | 0.8 s |
| Flatten to messages/blocks | 0.08 s | 0.1 s | 0.1 s |
| Metrics | 0.1 s | 0.2 s | 0.1 s |
| **Total** | **3.7 s** | **7.6 s** | **9.2 s** |

CDP throttling slows the main thread more than DuckDB's worker, so expect real phones to be somewhat slower; budget ~15 s with a progress UI. Memory: JS heap ~81 MB, DuckDB ~35 MB, plus the WASM module.

**Findings that shape Step 2–3:**
1. **Parity:** browser `by_hour`, chats (405), human messages (1,699) and tool calls (3,269) match `wrapped_v0.py` exactly for Europe/Lisbon.
2. **Timezones:** the ICU extension works and is DST-correct. For Lisbon, 2026-03-29 01:30 UTC → hour 2, and 2026-10-25 01:30 UTC → hour 1.
3. **Self-host the DuckDB extensions.** By default `icu` and `json` are fetched from `extensions.duckdb.org`, a third-party request. Setting `custom_extension_repository` and `autoinstall_extension_repository` to our own origin, and serving `/<engine-version>/wasm_eh/{icu,json}.duckdb_extension.wasm`, brings this to **zero external requests**. A build script must vendor these files, pinned to the engine version.
4. **Load with an explicit typed schema.** Declaring `chat_messages` as `STRUCT(...)[]`, with `content` as `STRUCT(type, name, text, thinking)[]` (unknown keys are ignored), is about **170× faster** than `JSON` + `from_json` (14.3 s → 0.08 s for flattening).
5. **Reserved words:** `text`, `type` and `name` must be quoted as column aliases in DuckDB SQL.
6. **Download size** (Brotli): duckdb-eh.wasm 5.5 MB, ICU 1.3 MB, JSON 0.1 MB, worker 0.2 MB, about **7.2 MB total**. This loads only after the user drops files (start prefetching on drop-zone hover or focus), so it doesn't affect Lighthouse for `/`.
7. **Design data bug:** the AI Clock design shows "15h · 223 / 3pm", but 223 is the 16h bucket. The real peak is 4pm (Lisbon). Cards must be computed from the data, never copied from the designs.

## Step 2: SQL metrics engine (the core data-engineering piece)
**Status: done (2026-11-24).** 0 differences vs v0 on all 41 keys (2 fixtures × 5 timezones + a real export in 3 timezones). 41 tests, 96% coverage; ruff + strict mypy clean. Found and fixed a spec gap: `longest_chat` titles and `your_top_words` are local-only too (see `docs/DATA.md`).

- `sql/00_load.sql` builds a flat model from the raw export: `chats(uuid, name, created_at)`, `messages(chat_uuid, uuid, parent_uuid, sender, created_at, text, n_files)` and `blocks(message_uuid, type, name, text_len, emdash_count)`. Local-time columns come from a `tz` parameter. The year filter applies here.
- `sql/metrics/*.sql` holds one file per metric group: volume, time (by_month, by_hour, by_weekday, streak, night/weekend share), words and tokens, tools, languages, chattiest_day, retries, thanks, club. Each file is readable on its own, with a header comment giving the definition. These files replace the definitions in `DATA.md` as the single source of truth.
- Counts from the other ZIPs (projects, design chats, artifacts, scheduled runs) are computed by the loader. They are passed in as a small `surfaces` table; their contents are never loaded beyond what's needed.
- `scripts/wrapped.py` is rewritten to load the export folder into Python `duckdb`, run the same SQL, and print `WrappedStats`. The original script stays as `scripts/legacy/wrapped_v0.py` for the parity check.
- **Parity with v0:**
  - `tests/test_parity.py` (pytest) runs both on every fixture × 5 timezones and compares.
  - Known engine differences are fixed deliberately and documented in `DATA.md` under "Changes from v0". These are: rounding (DuckDB rounds half away from zero, Python half to even); the RE2 `\b` used by DuckDB only recognises ASCII word characters, unlike Python's Unicode `\b`; code-point string length; and tie-breaking order. Each has an explicit test case.
- **Fixtures (synthetic):**
  - Add projects, design_chats, `claude_code_cloud` and `frames` stubs, plus a decoy `light_metadata` file containing a sentinel string.
  - Add an `edge-cases` export covering: timezone year boundaries, emoji and accented text, multilingual thanks, em-dashes, edits and regenerations, an empty first message, and ties.
  - Commit golden `fixtures/expected/*.json` files.
- **Tooling:** `ruff` + `mypy` for Python, pytest + coverage, and a CI job running Python 3.12.

## Step 3: App scaffold + upload `/`
**Status: done (2026-11-24).** Next.js 16.4 static export at `/wrapped`; DuckDB-WASM runs the bundled `sql/` in the browser; extensions self-hosted and SHA-256-pinned (`scripts/vendor-duckdb.mjs`). Browser output equals the CLI golden files for 2 fixtures × 5 timezones (Playwright), with zero cross-origin requests and no request bodies. 47 unit tests (ZIP privacy spy, allow-list, render), 15 browser tests, 120/120 green on repeat runs.
- Found and fixed two real UX races while hardening the tests: a stale timezone committed on blur, and input typed before hydration being lost (inputs now enable after hydration).
- Lighthouse (local, mobile): accessibility 96 → link underline fix applied; best practices 96 (only the `/_vercel/insights` 404, which exists on Vercel). Performance is dominated by the framework's hydration (~78 ms blocking at 1× CPU, ~710 ms at 4×); local scores swing 42–56 because this machine benchmarks at 370–760. **Re-measure with PageSpeed Insights on the deployed URL in Step 8**; if below 90, lazy-load the Analyzer island.

- Next.js 16 (App Router) with `output: 'export'` (fully static), `basePath: '/wrapped'`, TypeScript strict, Tailwind and shadcn/ui.
- Tooling: ESLint, `tsc --noEmit`, Vitest, Playwright. Libraries: `@duckdb/duckdb-wasm`, `jszip`, `fflate`, `zod`, `@vercel/analytics` (page views only).
- `lib/engine/`:
  - `zip.ts` identifies each ZIP by its entry paths and opens only the allowed files. For `frames` it counts entry names only. `light_metadata`, `memories` and `artifact_data` are never opened.
  - `worker.ts` runs JSZip → DuckDB → SQL. The SQL files are bundled as raw text, so the browser and the CLI run the same files.
  - Progress messages go back to the page.
- Upload page:
  - Hero, the three ways in (Site / Prompt kit / CLI), and the privacy promise.
  - A drop zone with a checklist of recognised ZIPs, including "light_metadata ignored, never opened".
  - Timezone is auto-detected and editable. Changing it re-runs only the SQL.
- Stats go into `sessionStorage`. Chat titles stay in the worker's memory only.
- `/privacy` covers Wrapped specifics: in-browser processing, fragment links, page-view analytics, how wall entries are made and removed. `/terms` covers no warranty and no affiliation with Anthropic. Both link to the main site's legal pages.
- **Tests:**
  - Vitest: ZIP recognition.
  - Privacy test: spy on JSZip `.async`; it must never be called on `light_metadata`, `frames` or `memories`, and the sentinel string must never appear in the output.
  - **Playwright:** drop the fixture ZIPs and check that the browser's JSON equals `fixtures/expected/*.json`. This is the browser-vs-CLI parity check.

## Step 4: Story + visualisation
**Status: done (2026-11-24).** `/story` with the 8 cards rebuilt from `design/` (brand + dark), AI Clock, tap/hold/swipe/keyboard navigation, auto-advance (off with reduced motion), edit panel, "show the query", `/story#demo` with André's real aggregates. Checked visually side by side against the design files. 96 unit tests (cards render for every golden × timezone with no title leaking), 24 browser tests.
- New local-only metric `chattiest_day_titles` feeds the opt-in example suggestion; suggestions pass `lib/story/safety.ts` and are off by default.
- Design data bugs not carried over: the clock's peak hour (designs say 3pm; data says 4pm), average day 7 vs 7.5, night share 11% vs 15%. "Researchers Club" overflowed the card in the design; sized to fit.
- Fixed while testing: arrow keys ignored after clicking a control; tag separators couldn't be typed.

- `components/cards/Card01…08` take `(stats, theme, n)` and lay out at a fixed 1080×1350 in SVG and HTML with inline styles. They are scaled to fit the viewport.
  - Themes come from `lib/theme.ts`: brand "Outono Quente" (default) and dark.
  - A shared `CardFrame` holds the progress bar, the "n/8" label, the CTA question, and "Get yours → barrosbuilds.com/wrapped · #tag".
  - `AiClock` is a radial SVG ported from `design/story-brand/06-ai-clock.dc.html`.
- `lib/story/derive.ts` (pure, unit-tested): clock archetype, busiest weekday, earliest habit, club role and rule text, verdict lines, and template opener and prediction.
- `lib/story/safety.ts` filters title-derived suggestions. Those suggestions are off by default, and the user must pick or edit before anything appears on a card.
- Viewer: tap or arrow keys to move, hold to pause, swipe, progress bar, theme toggle, and an "Edit before sharing" panel (name, #tag, opener, prediction, example).
- **"Show the query"** on each card opens the exact SQL that produced its number. This gives transparency and portfolio value.
- **Stretch, only if time allows:** an `/explore` view with a calendar heatmap, tool mix by month, and chat-length distribution, all in-browser from the same DuckDB tables.
- Demo: `/story#demo` uses your real 2026 numbers from the designs.

## Step 5: PNG + share/compare (no server)
**Status: done (2026-11-24).** Cards export to 1080×1350 PNGs in the browser (`html-to-image`, fonts embedded): one card, all 8 as a ZIP, or the phone share sheet. Share links `/s#…` (~1 KB) and compare links `/vs#a.b` carry stats only in the fragment; decoding is size-capped, bomb-proof and sanitised. Shared stories are read-only with "Compare with mine". 118 unit tests, 30 browser tests (PNG dimensions read from the file, no token in any request URL), green on repeat.
- Dropped the LinkedIn share-intent button: LinkedIn can't preview a fragment link (no server-rendered image), and its share URL would send the stats to LinkedIn as a query parameter. Posting the PNG plus pasting the link is the better flow.

- PNGs are rendered in the browser (`html-to-image`, fonts embedded, 1080×1350). There's a "Download all" option and, on mobile, Web Share API with files.
- `lib/share/codec.ts`: `WrappedStats` (no titles) → JSON → deflate → base64url, placed in the **fragment**. `decode` validates with zod and clamps every field. Covered by round-trip and malicious-input tests.
- `/s#<data>` is a read-only story. `/vs#<a>.<b>` shows two people side by side with a winner per stat; paste a friend's link to compare.
- These links get no automatic LinkedIn preview image. That's acceptable, because people post the PNG itself.

## Step 6: Prompt kit (done in the user's own Claude account)
- `prompts/full.md` (the old `exact.md`, upgraded): the user attaches the ZIPs (never `light_metadata`) in their own Claude chat. Claude computes the same metrics, following the definitions taken from `sql/metrics` comments, and replies with:
  1. a `WrappedStats` JSON block
  2. optionally, an HTML artifact preview of the cards
- `prompts/lite.md`: no export needed. It uses chat-history search and produces estimates.
- `/import` page: paste either prompt's JSON → zod validation → the same story, cards and PNGs. Lite results carry an "estimated" badge.
- Following your Claude API rule, no part of this calls the API: everything runs in the user's account.

## Step 7: GitHub Wall + open dataset
- From the story, a "Join the Wall" button builds an entry: `{display_name, tag, stats}`, previewed and editable. It then opens a prefilled GitHub "new file" URL for `wall/entries/<slug>.json`, so the user creates the pull request themselves.
- The `validate-wall` Action checks the schema, field caps, a simple name/tag blocklist, and one file per pull request. You review and merge.
- On merge, the `build-wall` Action aggregates the entries with DuckDB into:
  - `public/wall/leaderboards.json` (per tag)
  - `public/wall/distribution.json` (percentiles per stat)
  - `data/wall.parquet` (the open dataset)

  Merging triggers a Vercel rebuild.
- `/wall` and `/wall/[tag]` are static pages. **Rank lines** like "Top 8% for web searches" are computed in the visitor's browser against `distribution.json`, so their stats never leave the device.
- Removal is a pull request deleting the file, or an issue that you act on. Documented in `/privacy`.
- After launch: an `analysis/state-of-claude-2026` notebook built from the open dataset, as LinkedIn and portfolio content.

## Step 8: Deploy + launch
- Vercel project for `ai-wrapped` (static output) with Analytics page views on.
- In the main site repo (`andrebarros6/barrosbuilds`, `homepage/`):
  - On a new branch off `main` (that repo is currently on `learning-log-weekly-drip`, which I'll leave alone), add `async rewrites()` to `next.config.ts` for `/wrapped` and `/wrapped/:path*` pointing to `https://<ai-wrapped-prod>.vercel.app/wrapped/:path*`.
  - I'll show you the diff before committing, and test it on the main site's Vercel preview.
- Check through www.barrosbuilds.com/wrapped: pages, `/_next` assets, the DuckDB WASM file loading with the right MIME type, and the canonical URL.
- Run a `test-app` pass, then polish the README (GIF, three ways in, "⭐ star for the 2027 edition", CONTRIBUTING for a ChatGPT loader) and **make the repo public**.

**Cut from the original brief:** Supabase, edge functions, rate limiting, OG image route, analytics events, delete tokens.

## v1 definition of done
- Steps 0–5 live.
- Python and browser parity green.
- Lighthouse ≥90 on mobile for `/` (DuckDB lazy-loaded).
- A stranger goes from export ZIP to PNG in under 2 minutes, with no account and no network requests carrying their data (checked in the DevTools Network tab).
- Steps 6–7 follow before or right after launch, depending on time.

## Verification (every step)
- `npm run lint && npm run typecheck && npm test`, plus `ruff`, `mypy` and `pytest` (SQL parity against v0 across 5 timezones).
- Playwright: fixture ZIPs → browser stats equal the golden JSON → card 6 PNG is 1080×1350 → the `/s#…` round-trip renders the same numbers.
- Manual: run your real export through the site and through `python scripts/wrapped.py <export> Europe/Lisbon`; the numbers must match, and the Network tab must show only static assets.
- Coverage ≥80% on `lib/` and on the Python runner.
