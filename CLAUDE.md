# CLAUDE.md — AI Wrapped

You are building **AI Wrapped**: a Spotify-Wrapped-style recap of a person's year with Claude (ChatGPT next), shared as story cards on LinkedIn. It is an open-source reach/portfolio project by André Barros (BarrosBuilds). Success = GitHub stars + people sharing cards + people inviting friends/teams. It is not a paid product.

It is also a **data-engineering showcase**: a local-first analytics pipeline that runs entirely in the visitor's browser (DuckDB-WASM), with the same SQL powering a Python CLI.

Read these first, in order:
1. `docs/SPEC.md` — product, user flows, cards, virality mechanics, infra
2. `docs/DATA.md` — the Claude export format (verified on a real export) and the data model
3. `docs/PLAN.md` — build plan and current step
4. `sql/` — **source of truth for every metric**; `scripts/wrapped.py` runs it in Python, the site runs it in DuckDB-WASM
5. `design/` — the card designs to reproduce (see "Design references" below)

## Architecture: local-first, no backend
```
ZIPs ─► JSZip (browser, Web Worker) ─► DuckDB-WASM tables: chats, messages, blocks
                                         │  sql/metrics/*.sql  (same files ◄── Python CLI via duckdb)
                                         ▼
                                   WrappedStats JSON ─► cards (SVG/HTML) ─► PNG (in browser)
                                         │                     └─► #fragment share / compare
                                         └─► (opt-in) GitHub PR ─► Action ─► static leaderboards + open dataset
```

## Stack (don't swap it)
- Next.js (App Router) + TypeScript, Tailwind, shadcn/ui — **static export** (`output: 'export'`), `basePath: '/wrapped'`
- DuckDB-WASM in a Web Worker (browser), `duckdb` Python package (CLI); JSZip to read the export ZIPs
- Vercel static hosting; served at **`https://www.barrosbuilds.com/wrapped`** via a rewrite on the main barrosbuilds.com site (multi-zones)
- GitHub (PRs + Actions) for the Wall; no database
- Vercel Analytics: **page views only**, no custom events

## Non-negotiables
- **No backend, no database, no accounts, nothing stored.** Nothing about a visitor's data reaches any server.
- **Privacy first.** The export ZIP is parsed **in the browser only**. Never send raw chats, titles or message text anywhere. Share/compare links put stats in the URL **fragment** (`#…`), which browsers never send to a server.
- Never read `light_metadata` (email, phone, login IPs), `memories` or `artifact_data`; never open `frames` contents — count artifacts by entry names only. There is a test that enforces this.
- `chat_titles`, the title in `longest_chat` and `your_top_words` are **local-only** (see `docs/DATA.md`): never in a card, link or Wall entry. Shared stats use an allow-list.
- Before anything is shared, show an editable preview. Text fields generated from chat titles (opener, prediction, chattiest-day example) are off by default and must be user-confirmed.
- Every card carries the "Get yours → barrosbuilds.com/wrapped" line and the user's group tag.
- Browser and CLI must produce identical `WrappedStats` on `fixtures/` (Playwright + pytest check this). Any change from the v0 script (`scripts/legacy/wrapped_v0.py`) is deliberate and documented in `docs/DATA.md`. Dev setup: `python -m venv .venv`, `pip install -r requirements-dev.txt`; checks: `ruff check .`, `ruff format --check .`, `mypy`, `pytest`. After a deliberate metric change: `UPDATE_GOLDEN=1 pytest tests/test_golden.py`.
- Wall entries enter only through a pull request the user opens themselves.

## Build order (ship each step before starting the next — details in `docs/PLAN.md`)
0. Repo setup
1. **Spike** (go/no-go): DuckDB-WASM in a worker, ICU timezones, large `conversations.json`
2. **SQL metrics engine** (`sql/`) + Python CLI + parity with v0 + fixtures
3. **App scaffold + upload page** `/` (+ `/privacy`, `/terms`)
4. **Story viewer** `/story`: 8 cards, themes, "show the query", edit panel
5. **PNG + share/compare**: in-browser PNGs, `/s#…`, `/vs#a.b`
6. **Prompt kit**: `prompts/full.md` + `prompts/lite.md` → `/import`
7. **GitHub Wall** + open dataset + in-browser rank lines
8. **Deploy + launch**: main-site rewrite, `test-app` pass, README polish, repo public

## Design references
- `design/story-brand/` — **default theme** (Barros Builds "Outono Quente": bg `#1C1A17`, cream `#E8DCC8`, amber `#D4882B` for numbers, terracotta `#C4593A`/`#E07A57` for accents and links; Syne display, DM Sans body, DM Mono labels).
- `design/story-dark/` — alternate theme (near-black `#0E0F13`, lime `#C6F432`; Bricolage Grotesque + JetBrains Mono). Ship as a theme toggle.
- `design/early/` — earlier explorations; the AI Clock is the strongest single card.
- Files are `.dc.html` design components from Claude's design canvas: plain HTML with inline styles plus a `<script src="./support.js">` you can ignore. Treat them as pixel references: rebuild each as a React component taking `WrappedStats` as props. Numbers in them are André's real 2026 stats; use them as the demo data. Their footer line still says the old subdomain — use `barrosbuilds.com/wrapped`.

## Definition of done for v1
Steps 0–5 live at barrosbuilds.com/wrapped, browser/CLI parity green, Lighthouse ≥ 90 on mobile for `/`, and a stranger can go from export ZIP to PNG in under 2 minutes with no account and no network request carrying their data.
