"""AI Wrapped CLI: your year with Claude, computed locally.

Runs the same SQL as the website (sql/) on an unzipped Claude data export, using DuckDB.

Usage:
    python scripts/wrapped.py <folder with unzipped export> [IANA timezone] [--year 2026]

Reads only conversations, projects, design_chats, claude_code_cloud and the *names* of
artifact folders in frames. Never opens light_metadata, memories or artifact_data.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import duckdb

SQL_DIR = Path(__file__).resolve().parent.parent / "sql"
TZ_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$")


class ExportError(Exception):
    """The folder doesn't look like a Claude export."""


def _read_json(path: str) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _first(base: str, pattern: str) -> str | None:
    hits = sorted(glob.glob(os.path.join(base, pattern)))
    return hits[0] if hits else None


def render(sql: str, *, conversations: str, tz: str, year: int) -> str:
    """Fill the {{placeholders}} shared with the browser runner. Inputs are validated first."""
    if not TZ_RE.match(tz):
        raise ValueError(f"invalid timezone: {tz!r}")
    literal = "'" + conversations.replace("\\", "/").replace("'", "''") + "'"
    return sql.replace("{{conversations}}", literal).replace("{{tz}}", tz).replace("{{year}}", str(int(year)))


def load_sources(con: duckdb.DuckDBPyConnection, base: str) -> None:
    """Create the src_* tables from the non-conversation ZIPs (counts and dates only)."""
    projects = [
        _read_json(f).get("created_at")
        for f in sorted(glob.glob(os.path.join(base, "*projects*", "projects", "*.json")))
    ]
    design = []
    for f in sorted(glob.glob(os.path.join(base, "*design_chats*", "design_chats", "*.json"))):
        x = _read_json(f)
        proj = x.get("project")
        design.append((bool(x.get("messages")), proj.get("name") if proj else None, bool(proj)))
    artifacts = len(glob.glob(os.path.join(base, "*frames*", "artifacts", "*", "artifact.json")))
    runs_file = _first(base, os.path.join("*claude_code_cloud*", "claude_code_cloud", "routine_runs.json"))
    runs = len(_read_json(runs_file)["claude_code_cloud"]) if runs_file else None

    con.execute("CREATE OR REPLACE TABLE src_projects(created_at TIMESTAMPTZ)")
    if projects:
        con.executemany("INSERT INTO src_projects VALUES (?)", [(p,) for p in projects])
    con.execute(
        "CREATE OR REPLACE TABLE src_design_chats("
        "has_messages BOOLEAN, project_name VARCHAR, has_project BOOLEAN)"
    )
    if design:
        con.executemany("INSERT INTO src_design_chats VALUES (?, ?, ?)", design)
    con.execute("CREATE OR REPLACE TABLE src_counts(artifacts INTEGER, scheduled_runs INTEGER)")
    con.execute("INSERT INTO src_counts VALUES (?, ?)", [artifacts, runs])


def build_model(
    base: str, tz: str = "UTC", year: int = 2026
) -> tuple[duckdb.DuckDBPyConnection, dict[str, Any]]:
    """Load an export folder into a fresh DuckDB connection. Returns (connection, render params)."""
    conversations = _first(base, os.path.join("*conversations*", "conversations.json"))
    if not conversations:
        raise ExportError(f"no */conversations.json found in {base}")
    params: dict[str, Any] = {"conversations": conversations, "tz": tz, "year": year}
    load_sql = render((SQL_DIR / "00_load.sql").read_text(encoding="utf-8"), **params)
    con = duckdb.connect()
    try:
        load_sources(con, base)
        con.execute(load_sql)
    except Exception:
        con.close()
        raise
    return con, params


def compute(base: str, tz: str = "UTC", year: int = 2026) -> dict[str, Any]:
    """Return the full stats dict for an unzipped export folder."""
    con, params = build_model(base, tz, year)
    try:
        out: dict[str, Any] = {}
        for f in sorted((SQL_DIR / "metrics").glob("*.sql")):
            row = con.execute(render(f.read_text(encoding="utf-8"), **params)).fetchone()
            if row is None:
                raise RuntimeError(f"{f.name} returned no row")
            out.update(json.loads(row[0]))
        return out
    finally:
        con.close()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="AI Wrapped: your year with Claude, computed locally.")
    p.add_argument("export", help="folder containing the unzipped export ZIPs")
    p.add_argument("tz", nargs="?", default="UTC", help="IANA timezone, e.g. Europe/Lisbon")
    p.add_argument("--year", type=int, default=2026)
    a = p.parse_args(argv)
    try:
        stats = compute(a.export, a.tz, a.year)
    except (ExportError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    print(json.dumps(stats, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
