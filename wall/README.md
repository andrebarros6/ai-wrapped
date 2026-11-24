# The Wall

An opt-in, open leaderboard for AI Wrapped 2026. Each person is one JSON file in `entries/`, added
by that person through their own pull request. There is no database: a GitHub Action rebuilds the
static leaderboards (`public/wall/`) and the open dataset (`data/wall.parquet`) with DuckDB after
every merge.

## Join

1. Make your story at [barrosbuilds.com/wrapped](https://www.barrosbuilds.com/wrapped) from your
   export, the full prompt kit or the CLI. Lite estimates can't join.
2. Open the **Wall** tab, choose a display name and an optional group tag (your team, company or
   city), and read exactly what will be published.
3. Click **Open the pull request on GitHub**. GitHub copies the project to your account with your
   file filled in. Commit it and open the pull request.
4. A check validates the file. A maintainer reviews and merges it, and the Wall updates.

## What an entry contains

Only `display_name`, `tag`, `source`, and the aggregate numbers listed in
[`fields.json`](fields.json): no chat titles, no words, no free text. Example:

```json
{
  "version": 1,
  "year": 2026,
  "display_name": "Ana Silva",
  "tag": "lisbon-builders",
  "source": "claude-export",
  "stats": { "chats": 312, "your_messages": 2041, "...": "..." }
}
```

## Rules (checked automatically by `scripts/wall.py validate`)

- One entry per pull request, and the pull request may only touch `wall/entries/*.json`.
- File names: lower-case letters, numbers and hyphens.
- Exactly the fields in `fields.json`, with plausible values (for example, a streak can't be longer
  than your active days).
- Names: 1–32 letters, numbers, spaces and `. ' -`. Tags: lower-case letters, numbers and hyphens.
  Names and tags on [`blocklist.txt`](blocklist.txt), or impersonating Anthropic or OpenAI, are
  refused.
- One entry per name and tag: to update yours, edit your existing file.

The check runs the rules from the `main` branch, so a pull request can't change the rules it's
checked against. Maintainers review every entry before merging.

## Leave

Open a pull request that deletes your file, or [open an issue](../../issues) and we'll remove it.
Git keeps earlier versions of public repositories, so only submit what you're happy to publish.

## The open dataset

`data/wall.parquet` has every entry as one row. Query it straight from GitHub with DuckDB:

```sql
SELECT club, count(*) AS people, median(chats) AS median_chats
FROM 'https://github.com/andrebarros6/ai-wrapped/raw/main/data/wall.parquet'
GROUP BY club ORDER BY people DESC;
```

Rank lines on the site ("Top 8% for web searches") use `public/wall/distribution.json`, the
percentiles of each metric. They appear once 20 people have joined, and they're computed in each
visitor's browser.
