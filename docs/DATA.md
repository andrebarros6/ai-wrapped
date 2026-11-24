# Claude data export — what's in it (verified on a real export, Nov 2026)

Requested in claude.ai → Settings → Privacy → Export data (web/desktop only). Arrives by email as a manifest plus one ZIP per category; links expire after 24 h and may work only once.

| ZIP | Contents | Use |
|---|---|---|
| `conversations-000` | `conversations.json`: list of chats, **including chats inside Projects** (no project id on them) | Almost every metric |
| `projects-000` | `projects/<uuid>.json`: name, description, created_at, docs | Project count |
| `design_chats-000` | `design_chats/<uuid>.json`: title, project {uuid,name}, messages | Design chat count |
| `claude_code_cloud-000` | `routines.json`, `routine_runs.json` (scheduled tasks and their runs) | Scheduled runs |
| `frames-000` | `artifacts/<id>/…` artifact pages, versions, media (large) | Count folders only |
| `artifact_data-000` | per-artifact stored data | Ignore |
| `memories-000` | memory files | Ignore |
| `light_metadata-000` | `users.json` (email, phone), `login_history.json` (IPs) | **Never read** |

## conversations.json
```
[{ uuid, name, summary, created_at, updated_at, account,
   chat_messages: [{ uuid, text, sender: "human"|"assistant", created_at, updated_at,
                     attachments[], files[], parent_message_uuid,
                     content: [ {type:"text", text} | {type:"thinking", thinking}
                              | {type:"tool_use", name, input, …} | {type:"tool_result", …}
                              | {type:"token_budget", remaining:null} | "document" | "image" | … ] }] }]
```
Not available: real token counts, % of plan used, model per message. Tokens are estimated.

## Metric definitions
**Source of truth: `sql/metrics/*.sql`** — one file per group, each with a header comment defining its metrics. The same SQL runs in the browser (DuckDB-WASM) and in the CLI (`scripts/wrapped.py`, Python `duckdb`). Summary:

Timezone: user's IANA zone. Year filter: chats whose `created_at` is in the year (local time); all messages of those chats count.
- `chats` — conversations created in the year
- `your_messages` / `claude_messages` — messages by sender
- `active_days`, `longest_streak_days` — distinct local dates with ≥1 human message; longest run of consecutive dates
- `by_month`, `by_hour`, `by_weekday` — human messages by local time
- `your_words`, `claude_words` — characters / 5.5 (human `text`; assistant `text` blocks). Characters = Unicode code points
- `est_tokens_visible` — (human + assistant text + thinking characters) / 4. Excludes tool results and system text, so it's a floor
- `web_searches` — tool_use names containing "search", minus `conversation_search`
- `code_runs` — names containing "bash"; `files_created` — create_file / write / present_files / senduserfile
- `languages_first_msg` — stop-word vote on the first non-empty human message of each chat (pt, fr, es, en; extend in `chat_language`)
- `chattiest_day` — {date, messages, topics = distinct chat titles that day}
- `retries` — sibling branches: for each (chat, parent, sender) with k>1 children, add k−1 (edits + regenerations)
- `thanks` — whole words in human text: thanks|thank you|obrigad[oa]|merci|gracias|danke
- `em_dashes_from_claude` — count of "—" in assistant text blocks
- `night_share` — human messages 22:00–04:59 / all; `weekend_share`
- `club` — argmax of normalized scores (`90_club.sql`); placeholders until Wall data exists
- `projects_total`, `projects_created_<year>`, `design_chats`, `scheduled_runs`, `artifacts` — counts from the other ZIPs

Rounding is Python-style (half to even) via the `py_round` macro, so the SQL reproduces v0 exactly.

## Local-only fields (never shared)
These are computed for the user's own screen and must never appear in a card, share link or Wall entry:
- `chat_titles` — all titles (used only for opt-in, user-confirmed text suggestions)
- `longest_chat[1]` — the title of the longest chat (only the count `longest_chat[0]` may be shared)
- `your_top_words` — words from the user's own messages

## WrappedStats JSON (what cards, share links and Wall entries carry)
The CLI keys **minus the local-only fields above**, plus:
```
{ "version": 1, "source": "claude-export" | "full-prompt" | "lite-prompt", "year": 2026, "tz": "Europe/Lisbon",
  "display_name": "", "tag": "", "opener": "", "prediction": "", "chattiest_day_example": "" }
```
The share codec uses an explicit allow-list of keys, not a deny-list.

## Data model (DuckDB, built by `sql/00_load.sql`)
- `raw_chats` — conversations.json read with an explicit typed schema (unknown keys ignored)
- `chats(chat_idx, uuid, name, created_at, chat_messages)` — chats started in the year, local time
- `messages(chat_idx, chat_uuid, msg_idx, uuid, parent_uuid, sender, created_local, msg_text, n_files, content)`
- `blocks(chat_idx, chat_uuid, msg_idx, block_idx, sender, block_type, tool_name, text_len, emdash_count, thinking_len)`
- views: `human` (human messages + local date/hour/month/weekday), `tool_counts`, `chat_language`
- `src_projects`, `src_design_chats`, `src_counts` — created by the runner from the other ZIPs (dates and counts only)

`*_idx` columns keep file order, because v0 breaks ties by first-seen order (Python's `Counter`).

## Fixtures
- `fixtures/sample-export/` — 40 synthetic chats, conversations only (tests the "other ZIPs missing" path)
- `fixtures/edge-cases/` — generated by `scripts/make_fixtures.py`: timezone year boundaries, DST switches, emoji and accents, whole-word thanks, edits/regenerations, empty first messages, ties, unnamed tools, all other ZIPs
- `fixtures/expected/` — golden outputs per fixture × timezone (UTC, Lisbon, Los Angeles, Kolkata, Auckland). The browser engine must produce the same files.
- Private-file decoys (`light_metadata`, `memories`, `artifact_data`, frames contents) are created at test time only; the repo guard forbids committing them.

## Changes from v0
Verified: 0 differences on all 41 keys across both fixtures × 5 timezones, and on a real 405-chat export in 3 timezones. Deliberate differences:
- `scheduled_runs` is `null` when the `claude_code_cloud` ZIP is absent (v0 omitted the key).
- Files are read as UTF-8 everywhere. v0 used the platform encoding (cp1252 on Windows), which miscounts characters for non-ASCII text; parity tests run v0 with `python -X utf8`.
- A folder without `conversations.json`, or an invalid timezone, exits with a clear error (code 2) instead of a traceback. With zero chats, `longest_chat` is `null` (v0 crashed).
- Minimum Python is 3.10 (v0 needed 3.9). Windows needs the `tzdata` package for v0's `zoneinfo`; the SQL engine uses DuckDB's own ICU time zones.
