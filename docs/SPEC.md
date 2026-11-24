# AI Wrapped — Product spec

## Why
Reach and portfolio play for BarrosBuilds. OpenAI shipped "Your Year with ChatGPT" (Dec 2025) for ChatGPT only. Our angle: **independent, Claude-first (ChatGPT next), open source, privacy-first, and built to compare with friends and teams.** Launch target: first week of December, before the official recaps.

Second goal: a credible **data-engineering + visualisation** piece — a local-first analytics pipeline (DuckDB in the browser, shared SQL with a Python CLI) rather than a thin UI.

## Principles
- **Your data never leaves your device; ours doesn't exist.** No backend, no database, no accounts.
- **Little to run in production.** Static site + GitHub. Nothing to patch, scale or breach.
- **Transparent numbers.** Every card can show the SQL that produced it.

## Three ways in
| Way | Effort | Accuracy | How |
|---|---|---|---|
| **Site** (main path) | ~5 min | Exact | Request the data export in Claude settings → drop the ZIPs at barrosbuilds.com/wrapped → DuckDB-WASM computes everything in the browser. No upload, no account. |
| **Prompt kit** | 1–5 min | Exact (`full.md`) or estimates (`lite.md`) | Run a prompt in your own Claude account. `full.md`: attach the export ZIPs, Claude computes the stats in its sandbox. `lite.md`: no export, uses chat-history search. Paste the JSON at `/import` → same cards. |
| **CLI** | dev | Exact | `python scripts/wrapped.py <export-folder> <timezone>` — same SQL as the site. The GitHub-star magnet. |

Which ZIPs to drop: `conversations`, `projects`, `design_chats`, `claude_code_cloud` (and optionally `frames` for an artifact count). Never `light_metadata` — and if it is dropped anyway, it is ignored without being opened.

## The story (8 cards, 1080×1350)
1. **Opener** — the year in one sentence (template from stats by default; title-derived suggestions are opt-in, user confirms or edits).
2. **The numbers** — chats, messages sent.
3. **How you work** — tiles: chats, projects, design chats, artifacts, scheduled runs, web searches.
4. **Chattiest day** — date, messages, number of topics, one user-chosen safe example; vs average day.
5. **AI Club** — one of six clubs (Researchers, Builders, Coders, Night Shift, Polyglots, Talkers) with the rule shown on the card. Thresholds are v1 placeholders, recalibrated from the open Wall dataset.
6. **AI Clock** — radial chart of messages by hour; archetype from peak hour (e.g. Early Bird, Afternoon Operator, Night Shift); busiest weekday; % after 10pm.
7. **Try again** — retries (edits + regenerations) vs thank-yous.
8. **2027 prediction** — playful, templated or user-edited; "come back next December".

Spare cards (theme packs later): em-dashes Claude sent you, words you wrote vs Claude (in novels), one-shot chats, longest break, weekday warrior. Stretch: `/explore` with a calendar heatmap, tool mix by month, chat-length distribution.

Every card: progress bar, "AI WRAPPED 2026 · n/8", one hero number, a comparison question as CTA, "Get yours → barrosbuilds.com/wrapped · #tag", and a "show the query" toggle (on screen only).

## Virality mechanics (the point of the project)
- **Comparison CTA on every card** ("Which club is your team in?").
- **PNG first:** people post the card image itself on LinkedIn; no server-rendered link previews.
- **Compare link** `/vs#a.b`: paste a friend's share link, see who wins each stat. The "Prove it" loop. Stats live in the URL fragment.
- **Group tags**: user adds `#acme`, `#lisbon-builders` → `/wall/acme` leaderboard.
- **The Wall (GitHub)**: opt-in. The site prepares `wall/entries/<slug>.json` and opens a prefilled GitHub "new file" page; the user opens the PR. An Action validates it; on merge another Action rebuilds static leaderboards, percentile distributions and an open dataset (`data/wall.parquet`). Contributors star repos.
- **Rank lines** ("Top 8% for web searches") are computed in the visitor's browser against the static distribution file.
- **Year-end analysis**: "State of Claude usage 2026" from the open dataset — LinkedIn + portfolio content.
- **Repo hooks**: "⭐ Star to get the 2027 edition", "Add a ChatGPT loader" good-first-issue.

## Privacy
- Parsing and computing happen client-side; no server ever receives chat text, titles or stats.
- Share/compare links carry only the user-reviewed stats JSON, compressed, in the URL fragment.
- Wall entries contain only stats JSON + display name + tag, and exist only if the user opens a PR. Removal: a PR deleting the file, or an issue André acts on.
- Title-derived text is opt-in and editable; filter out health, money, legal, family, job-rejection and people's names before suggesting anything.
- Analytics: cookieless Vercel page views only. No custom events.
- No accounts exist, so there is nothing to delete beyond optional wall entries.

## Infra
- Static Next.js export on Vercel, `basePath: '/wrapped'`, served at `https://www.barrosbuilds.com/wrapped` via a rewrite in the main site (`andrebarros6/barrosbuilds`, `homepage/next.config.ts`).
- GitHub Actions: `guard-private-data`, CI (lint/typecheck/tests/parity), `validate-wall`, `build-wall`.

## Out of scope
Any backend or database, accounts, paid tiers, server-rendered OG images, analytics events, storing exports. ChatGPT loader is v1.1 (community PR welcome).
