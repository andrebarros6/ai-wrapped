# Contributing to AI Wrapped

Thanks for helping. Two kinds of contribution are most welcome: **new export loaders** (starting with ChatGPT) and **fixes**. If you only want to appear on the leaderboard, see [`wall/README.md`](wall/README.md) instead.

## Ground rules (non-negotiable)

These are why people trust the project. A pull request that breaks one won't be merged.

1. **No backend, no database, no accounts.** Everything runs in the visitor's browser (or their own AI account, or the CLI).
2. **Exports are read in the browser only.** No request may carry chat content, titles, words or stats to any server. The Content-Security-Policy (`connect-src 'self'`) enforces this; don't loosen it.
3. **Open only what the stats need.** Never open private parts of an export (Claude's `light_metadata`, memories, artifact contents, or their equivalents elsewhere). Decide from file *names* before decompressing anything.
4. **Chat titles and people's own words stay local.** Shared stats go through the allow-list in `lib/engine/stats.ts`.
5. **The site, the CLI and the prompt kit must agree exactly.** Metrics live in `sql/` and are tested against golden outputs.
6. **No em dashes in anything a visitor sees.** A test enforces it.

## Good first issue: a ChatGPT loader

ChatGPT's export contains a `conversations.json` with a different shape (a tree of `mapping` nodes per conversation). A loader turns it into the same three tables Claude's loader builds, so **every metric and card works unchanged**:

- `chats(chat_idx, uuid, name, created_at, chat_messages)`
- `messages(chat_idx, chat_uuid, msg_idx, uuid, parent_uuid, sender, created_local, msg_text, n_files, content)`
- `blocks(chat_idx, chat_uuid, msg_idx, block_idx, sender, block_type, tool_name, text_len, emdash_count, thinking_len)`

See [`sql/00_load.sql`](sql/00_load.sql) and the data model in [`docs/DATA.md`](docs/DATA.md).

What a loader pull request needs:

1. `sql/loaders/chatgpt.sql`, producing those tables (`sender = 'human'` for the user's messages).
2. Detection in `lib/engine/zip.ts` (by file names, before opening anything) and in `scripts/wrapped.py`.
3. A **synthetic** fixture in `fixtures/` (never real chats) and its golden outputs, plus tests: CLI = browser = goldens.
4. A note in `docs/DATA.md` on anything that doesn't map cleanly (for example, metrics ChatGPT exports can't support), and the cards should hide what can't be filled (see `available` in `components/cards/cards.tsx`).

Comment on the issue before starting so two people don't build the same thing.

## Setup

```
npm ci
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt     # macOS/Linux: .venv/bin/pip
npm run dev                                          # http://localhost:3000/wrapped
```

## Before you open a pull request

All of these must pass (CI runs them too):

```
npm run lint && npm run typecheck && npm test
npm run build && npm run test:e2e        # Chromium, against the static build
npm run test:browsers                    # Firefox and WebKit
ruff check . && ruff format --check . && mypy && pytest
```

- Changed a metric on purpose? Regenerate the golden files with `UPDATE_GOLDEN=1 pytest tests/test_golden.py` and explain the change in `docs/DATA.md`.
- Changed `scripts/prompt_kit.py`? Run `python scripts/build_prompts.py`.
- Add tests for new behaviour. Keep each commit to one logical change, with a message that says why.

## Reporting a privacy or security problem

Please don't open a public issue. Contact André through [barrosbuilds.com](https://www.barrosbuilds.com) first.
