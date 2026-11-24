# CLAUDE.md — AI Wrapped

You are building **AI Wrapped**: a Spotify-Wrapped-style recap of a person's year with Claude (ChatGPT next), shared as story cards on LinkedIn. It is an open-source reach/portfolio project by André Barros (BarrosBuilds). Success = GitHub stars + people sharing cards + people inviting friends/teams. It is not a paid product.

Read these first, in order:
1. `docs/SPEC.md` — product, user flows, cards, virality mechanics, infra
2. `docs/DATA.md` — the Claude export format (verified on a real export) and every metric's definition
3. `design/` — the card designs to reproduce (see "Design references" below)
4. `scripts/wrapped.py` — reference implementation of every metric (Python). The web app must produce the same numbers.

## Stack (André's standard — don't swap it)
- Next.js (App Router) + TypeScript, Tailwind, shadcn/ui
- Vercel for hosting; subdomain `wrapped.barrosbuilds.com`
- Supabase only for the Wall (submitted cards + group leaderboards)
- `@vercel/og` (Satori) for share images and OG previews
- JSZip in the browser to read the export ZIP

## Non-negotiables
- **Privacy first.** The export ZIP is parsed **in the browser only**. Never upload raw chats, titles or message text to any server. Only the final, user-previewed stats JSON can leave the device, and only when the user clicks share/submit.
- Never read `light_metadata` (it holds email, phone, login IPs) or `frames`/`artifact_data` contents. Count artifacts by folder only.
- Before anything is shared, show an editable preview. Text fields generated from chat titles (opener, prediction, chattiest-day example) are off by default and must be user-confirmed.
- Every card carries the "Get yours → wrapped.barrosbuilds.com" line and the user's group tag.
- Card numbers must match `scripts/wrapped.py` on `fixtures/sample-export`. Write a test that checks this.

## Build order (ship each step before starting the next)
1. **Parser** (`lib/parse/`): TS port of `scripts/wrapped.py`, runs on a `File` in the browser, outputs `WrappedStats` (schema in `docs/DATA.md`). Unit tests against `fixtures/`.
2. **Upload page** `/`: hero, 3-step how-to, drop zone for the ZIPs, privacy promise. Timezone auto-detected (editable).
3. **Story viewer** `/story`: the 8 cards, tap/arrow to advance, progress bar, pause on hold. Mobile-first.
4. **Share**: each card downloadable as 1080×1350 PNG; "share story" link `/s/[encoded]` where the stats live in the URL (compressed, no DB). OG image = card 1 of that person.
5. **Lite mode** `/lite`: copy-paste prompt (`prompts/lite.md`) → paste JSON → same story viewer with an "estimated" badge.
6. **Compare** `/vs/[a]/[b]`: two share links side by side, winner per stat.
7. **Wall** `/wall` + `/wall/[tag]`: opt-in submit of stats JSON to Supabase, leaderboards per group tag, rank lines like "Top 8% for web searches". Rate-limit + profanity filter on names/tags.
8. **Repo polish**: README with GIF, gallery, "⭐ star to get the 2027 edition", CONTRIBUTING for adding a ChatGPT parser.

## Design references
- `design/story-brand/` — **default theme** (Barros Builds "Outono Quente": bg `#1C1A17`, cream `#E8DCC8`, amber `#D4882B` for numbers, terracotta `#C4593A`/`#E07A57` for accents and links; Syne display, DM Sans body, DM Mono labels).
- `design/story-dark/` — alternate theme (near-black `#0E0F13`, lime `#C6F432`; Bricolage Grotesque + JetBrains Mono). Ship as a theme toggle.
- `design/early/` — earlier explorations; the AI Clock is the strongest single card.
- Files are `.dc.html` design components from Claude's design canvas: plain HTML with inline styles plus a `<script src="./support.js">` you can ignore. Treat them as pixel references: rebuild each as a React component taking `WrappedStats` as props. Numbers in them are André's real 2026 stats; use them as the demo data.

## Definition of done for v1
Steps 1–4 live on Vercel, Lighthouse ≥ 90 on mobile, parser tests green, a stranger can go from export ZIP to shared PNG in under 2 minutes without creating an account.
