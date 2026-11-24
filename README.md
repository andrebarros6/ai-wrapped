# AI Wrapped 2026

Your year with Claude, as story cards you can share and compare. Open source, private by design: your export is analysed **in your browser** with DuckDB and never uploaded. No accounts, no database, no backend.

**Get yours → barrosbuilds.com/wrapped** · ⭐ Star to get the 2027 edition

## Three ways
- **Site** (5 min): export your data from Claude, drop the ZIPs on the site. Everything runs locally in your browser.
- **Prompt kit**: run `prompts/full.md` (with your export) or `prompts/lite.md` (no export, estimates) in your own Claude account, paste the JSON at `/import`.
- **CLI** (devs): `pip install -r requirements.txt` then `python scripts/wrapped.py path/to/unzipped-export Europe/Lisbon` — the same SQL the site runs.

## Repo
- `CLAUDE.md`: build brief for Claude Code
- `docs/SPEC.md`, `docs/DATA.md`, `docs/PLAN.md`: product spec, export format and data model, build plan
- `sql/`: every metric as SQL — the single source of truth for site and CLI
- `scripts/wrapped.py`: CLI runner (Python 3.10+, DuckDB)
- `design/`: card designs (brand theme and dark theme)
- `fixtures/`: synthetic sample export for tests

Built by André Barros · BarrosBuilds 2026
