# AI Wrapped — Product spec

## Why
Reach and portfolio play for BarrosBuilds. OpenAI shipped "Your Year with ChatGPT" (Dec 2025) for ChatGPT only. Our angle: **independent, Claude-first (ChatGPT next), open source, privacy-first, and built to compare with friends and teams.** Launch target: first week of December, before the official recaps.

## Three ways in
| Tier | Effort | Accuracy | How |
|---|---|---|---|
| **Lite** | 30 s | Estimates | Copy a prompt into Claude/ChatGPT (uses its chat-history search) → paste JSON back. Can't see everything; badge cards "estimated". |
| **Exact** (main path) | ~5 min | Exact | Request the data export in Claude settings → drop the ZIPs on the site → parsed in the browser. No upload, no account. |
| **Deep** | dev | Exact | `python scripts/wrapped.py <export-folder> <timezone>` locally. The GitHub-star magnet. |

Fallback for Exact if a browser chokes on a big ZIP: `prompts/exact.md` (upload ZIPs to a Claude chat, Claude runs the analysis in its sandbox).

Which ZIPs to drop: `conversations`, `projects`, `design_chats`, `claude_code_cloud` (and optionally `frames` for an artifact count). Never `light_metadata`.

## The story (8 cards, 1080×1350)
1. **Opener** — the year in one sentence (generated from chat titles; user confirms or edits; default is a template sentence from stats).
2. **The numbers** — chats, messages sent.
3. **How you work** — tiles: chats, projects, design chats, artifacts, scheduled runs, web searches.
4. **Chattiest day** — date, messages, number of topics, one user-chosen safe example; vs average day.
5. **AI Club** — one of six clubs (Researchers, Builders, Coders, Night Shift, Polyglots, Talkers) with the rule shown on the card. Rule in `scripts/wrapped.py`; thresholds are v1 placeholders, recalibrate from Wall data.
6. **AI Clock** — radial chart of messages by hour; archetype from peak hour (e.g. Early Bird, Afternoon Operator, Night Shift); busiest weekday; % after 10pm.
7. **Try again** — retries (edits + regenerations) vs thank-yous.
8. **2027 prediction** — playful, generated or templated; "come back next December".

Spare cards (theme packs later): em-dashes Claude sent you, words you wrote vs Claude (in novels), one-shot chats, longest break, weekday warrior.

Every card: progress bar, "AI WRAPPED 2026 · n/8", one hero number, a comparison question as CTA, "Get yours → wrapped.barrosbuilds.com · #tag".

## Virality mechanics (the point of the project)
- **Comparison CTA on every card** ("Which club is your team in?").
- **Group tags**: user adds `#acme`, `#lisbon-builders` → `/wall/acme` leaderboard. Company and friend-group competition.
- **Compare link** `/vs/a/b`: paste a friend's link, see who wins each stat. The "Prove it" loop.
- **Rank lines** once the Wall has data: "Top 8% for web searches".
- **The Wall**: opt-in gallery of submitted cards. Devs can also add theirs by PR to `wall/` (validated by a GitHub Action) → contributors star repos.
- **Repo hooks**: "⭐ Star to get the 2027 edition", "Add a ChatGPT parser" good-first-issue.

## Privacy
- Parsing happens client-side; the site never receives chat text or titles.
- Share links carry only the stats JSON (compressed in the URL).
- Wall submissions store only the stats JSON + display name + tag; deletable by a secret link given at submit time.
- Title-derived text is opt-in and editable; filter out health, money, legal, family, job-rejection and people's names before suggesting anything.

## Infra
- Vercel (Next.js App Router), `wrapped.barrosbuilds.com`.
- Supabase: `wall_entries(id, created_at, display_name, tag, stats jsonb, delete_token)`, RLS: public read, insert via edge function with rate limit; materialized view per tag for leaderboards.
- `@vercel/og` routes: `/api/card/[n]?d=<encoded>` → PNG; used for downloads and OG previews.
- Analytics: Vercel Analytics, events `export_dropped`, `story_completed`, `card_downloaded`, `link_shared`, `compare_opened`, `wall_submitted`.

## Out of scope for v1
Accounts, paid tiers, ChatGPT parser (v1.1, community PR welcome), storing exports.
