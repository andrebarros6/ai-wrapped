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
Source of truth: `sql/metrics/*.sql` (from Step 2; until then `scripts/wrapped.py`, kept afterwards as `scripts/legacy/wrapped_v0.py`). The same SQL runs in the browser (DuckDB-WASM) and in the CLI (Python `duckdb`).
Timezone: user's IANA zone. Year filter: chats whose `created_at` is in the year.
- `chats` — conversations created in the year
- `your_messages` / `claude_messages` — messages by sender
- `active_days`, `longest_streak_days` — distinct local dates with ≥1 human message; longest run of consecutive dates
- `by_month`, `by_hour`, `by_weekday` — human messages by local time
- `your_words`, `claude_words` — characters / 5.5 (human `text`; assistant `text` blocks)
- `est_tokens_visible` — (human + assistant text + thinking characters) / 4. Excludes tool results and system text, so it's a floor
- `web_searches` — tool_use names containing "search", minus `conversation_search`
- `code_runs` — names containing "bash"; `files_created` — create_file / write / present_files / senduserfile
- `languages` — stop-word vote on the first human message of each chat (pt, fr, es, en; extend)
- `chattiest_day` — {date, messages, topics = distinct chat titles that day}
- `retries` — sibling branches: for each (chat, parent, sender) with k>1 children, add k−1 (edits + regenerations)
- `thanks` — regex over human text: thanks|thank you|obrigad[oa]|merci|gracias|danke
- `em_dashes_from_claude` — count of "—" in assistant text blocks
- `night_share` — human messages 22:00–04:59 / all; `weekend_share`
- `club` — argmax of normalized scores (see script); placeholders until Wall data exists
- `projects`, `design_chats`, `scheduled_runs`, `artifacts` — counts from the other ZIPs

## WrappedStats JSON (what the parser outputs and the cards consume)
Exactly the keys printed by the CLI, minus `chat_titles` (local only, never leaves the browser worker), plus:
```
{ "version": 1, "source": "claude-export" | "full-prompt" | "lite-prompt", "year": 2026, "tz": "Europe/Lisbon",
  "display_name": "", "tag": "", "opener": "", "prediction": "", "chattiest_day_example": "" }
```
`fixtures/sample-export/` is synthetic data for tests (no real chats).

## Data model (DuckDB, built by `sql/00_load.sql`)
- `chats(uuid, name, created_at, created_local)` — filtered to the year in the user's timezone
- `messages(chat_uuid, uuid, parent_uuid, sender, created_at, created_local, text, n_files)`
- `blocks(message_uuid, sender, type, name, text_len, emdash_count)` — one row per content block
- `surfaces(projects_total, projects_created, design_chats, design_chats_with_msgs, design_projects, artifacts, scheduled_runs)` — counts computed by the loader from the other ZIPs

## Changes from v0
Deliberate differences between the SQL engine and `scripts/legacy/wrapped_v0.py` are listed here, each with a test case. (Filled in during Step 2.)
