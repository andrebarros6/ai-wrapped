"""The Wall: validate entry pull requests and build the static leaderboards + open dataset.

    python scripts/wall.py validate --base origin/main   # PR check: only safe, plausible entries
    python scripts/wall.py build                         # after merge: rebuild the static files

Entries live in wall/entries/<name>-<random>.json and are added by people through their own pull
requests. Fields are defined once in wall/fields.json (also read by the site).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
WALL = ROOT / "wall"
ENTRIES = WALL / "entries"
FIELDS: dict[str, Any] = json.loads((WALL / "fields.json").read_text(encoding="utf-8"))

MAX_FILE_BYTES = 8_000
FILENAME_RE = re.compile(r"^[a-z0-9-]{3,60}\.json$")
TAG_RE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?)?$")
NAME_RE = re.compile(r"^[\w .'’-]{1,32}$")
MAX_COUNT = 10_000_000
MAX_BIG = 5_000_000_000  # tokens, words
LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})


class EntryError(ValueError):
    pass


def _plain(text: str) -> str:
    """Lower-case, accents stripped, leetspeak undone: 'Sh1t Head' -> 'shit head'."""
    return unicodedata.normalize("NFKD", text.lower().translate(LEET)).encode("ascii", "ignore").decode()


def normalise(text: str) -> str:
    """Letters only: 'Sh1t-Head' -> 'shithead'."""
    return re.sub(r"[^a-z]", "", _plain(text))


def _blocklist() -> tuple[list[str], list[str]]:
    """(substrings, whole words). Lines starting with '=' match whole words only."""
    lines = [w.strip() for w in (WALL / "blocklist.txt").read_text(encoding="utf-8").splitlines()]
    words = [w for w in lines if w and not w.startswith("#")]
    return (
        [normalise(w) for w in words if not w.startswith("=")],
        [normalise(w[1:]) for w in words if w.startswith("=")],
    )


def blocked(text: str) -> bool:
    contains, whole = _blocklist()
    squashed = normalise(text)
    tokens = set(re.findall(r"[a-z]+", _plain(text)))
    return any(w in squashed for w in contains) or any(w in tokens for w in whole)


def validate_entry(entry: Any) -> None:
    """Raise EntryError with a human-readable reason if the entry can't go on the Wall."""
    if not isinstance(entry, dict):
        raise EntryError("entry must be a JSON object")
    expected = {"version", "year", "display_name", "tag", "source", "stats"}
    if set(entry) != expected:
        raise EntryError(f"entry keys must be exactly {sorted(expected)}")
    if entry["version"] != 1 or entry["year"] != FIELDS["year"]:
        raise EntryError(f"version must be 1 and year {FIELDS['year']}")
    if entry["source"] not in FIELDS["sources"]:
        raise EntryError("only exact stats (export, full prompt kit or CLI) can join the Wall, not estimates")

    name, tag = entry["display_name"], entry["tag"]
    if not isinstance(name, str) or not NAME_RE.match(name) or not name.strip():
        raise EntryError("display_name: 1-32 letters, numbers, spaces, . ' -")
    if not isinstance(tag, str) or not TAG_RE.match(tag):
        raise EntryError("tag: empty, or lower-case letters, numbers and inner hyphens (max 24)")
    if blocked(name) or blocked(tag):
        raise EntryError("display_name or tag isn't allowed on the Wall")

    s = entry["stats"]
    counts, shares = FIELDS["counts"], FIELDS["shares"]
    expected_stats = set(counts) | set(shares) | {"club", "languages"}
    if not isinstance(s, dict) or set(s) != expected_stats:
        raise EntryError(f"stats keys must be exactly {sorted(expected_stats)}")
    for k in counts:
        limit = MAX_BIG if k in ("est_tokens_visible", "your_words") else MAX_COUNT
        if not isinstance(s[k], int) or isinstance(s[k], bool) or not 0 <= s[k] <= limit:
            raise EntryError(f"stats.{k} must be a whole number between 0 and {limit}")
    for k in shares:
        if not isinstance(s[k], (int, float)) or isinstance(s[k], bool) or not 0 <= s[k] <= 1:
            raise EntryError(f"stats.{k} must be between 0 and 1")
    if s["club"] not in FIELDS["clubs"]:
        raise EntryError("stats.club isn't a known club")
    if (
        not isinstance(s["languages"], int)
        or isinstance(s["languages"], bool)
        or not 0 <= s["languages"] <= 20
    ):
        raise EntryError("stats.languages must be 0-20")

    # Plausibility: numbers that can't come out of a real export.
    rules: list[tuple[bool, str]] = [
        (s["chats"] >= 1, "chats must be at least 1"),
        (1 <= s["active_days"] <= 366, "active_days must be 1-366"),
        (1 <= s["longest_streak_days"] <= s["active_days"], "longest_streak_days can't exceed active_days"),
        (s["your_messages"] >= s["active_days"], "every active day has at least one message"),
        (
            s["tool_calls"] >= max(s["web_searches"], s["code_runs"]),
            "web searches and code runs are tool calls",
        ),
        (s["est_tokens_visible"] >= s["your_words"], "estimated tokens can't be fewer than your words"),
    ]
    for ok, reason in rules:
        if not ok:
            raise EntryError(f"implausible stats: {reason}")


def check_changes(
    changes: list[tuple[str, str]], read: Callable[[str], bytes], existing: list[dict[str, Any]]
) -> None:
    """Validate a PR's changed files. `changes` = (git status letter, path)."""
    if not changes:
        raise EntryError("no changes")
    added = []
    for status, path in changes:
        if not re.fullmatch(r"wall/entries/[^/]+\.json", path):
            raise EntryError(f"a Wall pull request may only touch wall/entries/*.json (found {path})")
        if not FILENAME_RE.match(Path(path).name):
            raise EntryError(f"file name must be lower-case letters, numbers and hyphens: {path}")
        if status != "D":
            added.append(path)
    if len(added) > 1:
        raise EntryError("one entry per pull request, please")
    for path in added:
        raw = read(path)
        if len(raw) > MAX_FILE_BYTES:
            raise EntryError(f"{path} is too large")
        try:
            entry = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            raise EntryError(f"{path} isn't valid JSON: {e}") from e
        validate_entry(entry)
        stem = Path(path).stem
        for other in existing:
            if other["_id"] != stem and (other["display_name"], other["tag"]) == (
                entry["display_name"],
                entry["tag"],
            ):
                raise EntryError(
                    "someone with this name and tag is already on the Wall: edit that file instead"
                )


def load_entries() -> list[dict[str, Any]]:
    out = []
    for f in sorted(ENTRIES.glob("*.json")):
        entry = json.loads(f.read_text(encoding="utf-8"))
        entry["_id"] = f.stem
        out.append(entry)
    return out


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True, check=True).stdout


def cmd_validate(base: str, repo: Path) -> int:
    """Check the pull request checked out at `repo`. The rules (this script, fields.json, blocklist.txt)
    come from wherever this script lives: CI runs the base branch's copy, so a PR can't loosen them."""
    lines = _git(repo, "diff", "--name-status", "--no-renames", f"{base}...HEAD").splitlines()
    changes = [(line.split("\t")[0][0], line.split("\t")[-1]) for line in lines if line.strip()]
    base_entries = []
    for line in _git(repo, "ls-tree", "--name-only", base, "wall/entries/").splitlines():
        if line.endswith(".json"):
            entry = json.loads(_git(repo, "show", f"{base}:{line}"))
            entry["_id"] = Path(line).stem
            base_entries.append(entry)
    try:
        check_changes(changes, lambda p: (repo / p).read_bytes(), base_entries)
    except EntryError as e:
        print(f"::error::{e}")
        return 1
    print(f"OK: {len(changes)} change(s) to the Wall look good.")
    return 0


# ---- build: DuckDB turns the entries into static files ---------------------------------------


def build(out_public: Path = ROOT / "public" / "wall", out_data: Path = ROOT / "data") -> dict[str, Any]:
    import duckdb  # only the build needs it; validation stays dependency-free

    entries = load_entries()
    for e in entries:
        validate_entry({k: v for k, v in e.items() if k != "_id"})
    counts, shares = list(FIELDS["counts"]), list(FIELDS["shares"])
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE wall (id VARCHAR, display_name VARCHAR, tag VARCHAR, source VARCHAR, club VARCHAR, "
        "languages INTEGER, "
        + ", ".join(f"{c} BIGINT" for c in counts)
        + ", "
        + ", ".join(f"{s} DOUBLE" for s in shares)
        + ")"
    )
    rows = [
        (e["_id"], e["display_name"], e["tag"], e["source"], e["stats"]["club"], e["stats"]["languages"])
        + tuple(e["stats"][c] for c in counts)
        + tuple(e["stats"][s] for s in shares)
        for e in entries
    ]
    if rows:
        con.executemany(f"INSERT INTO wall VALUES ({', '.join('?' * (6 + len(counts) + len(shares)))})", rows)

    n = len(entries)
    out_public.mkdir(parents=True, exist_ok=True)
    out_data.mkdir(parents=True, exist_ok=True)

    tags = con.execute(
        "SELECT tag, count(*) AS members, sum(chats) AS chats FROM wall WHERE tag <> '' "
        "GROUP BY tag ORDER BY members DESC, tag"
    ).fetchall()
    cols = ["id", "display_name", "tag", "club", "languages", *counts, *shares]
    people = [
        dict(zip(cols, r, strict=True))
        for r in con.execute(f"SELECT {', '.join(cols)} FROM wall ORDER BY chats DESC, id").fetchall()
    ]
    clubs = dict(con.execute("SELECT club, count(*) FROM wall GROUP BY club ORDER BY club").fetchall())
    wall = {
        "version": 1,
        "year": FIELDS["year"],
        "generated": date.today().isoformat(),
        "count": n,
        "tags": [{"tag": t, "members": m, "chats": c} for t, m, c in tags],
        "clubs": clubs,
        "entries": people,
    }

    # Percentiles for rank lines ("Top 8% for web searches"), computed in visitors' browsers.
    min_n = FIELDS["min_entries_for_ranks"]
    metrics: dict[str, list[float]] | None = None
    if n >= min_n:
        qs = ", ".join(f"{i / 100:.2f}" for i in range(101))
        metrics = {}
        for m in FIELDS["rank_metrics"]:
            row = con.execute(f"SELECT quantile_cont({m}, [{qs}]) FROM wall").fetchone()
            metrics[m] = [round(float(v), 4) for v in row[0]] if row else []
    distribution = {"version": 1, "count": n, "min_entries": min_n, "metrics": metrics}

    # LF everywhere, so files built on Windows and in CI are byte-identical.
    (out_public / "wall.json").write_text(
        json.dumps(wall, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    (out_public / "distribution.json").write_text(
        json.dumps(distribution, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    parquet = (out_data / "wall.parquet").as_posix().replace("'", "''")
    con.execute(f"COPY (SELECT * FROM wall ORDER BY id) TO '{parquet}' (FORMAT parquet)")
    con.close()
    return wall


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate", help="check a pull request's changes")
    v.add_argument("--base", default="origin/main")
    v.add_argument("--repo", type=Path, default=ROOT, help="pull request checkout (default: here)")
    sub.add_parser("build", help="rebuild public/wall/*.json and data/wall.parquet")
    a = p.parse_args(argv)
    if a.cmd == "validate":
        return cmd_validate(a.base, a.repo.resolve())
    wall = build()
    print(f"built the Wall: {wall['count']} entries, {len(wall['tags'])} tags")
    return 0


if __name__ == "__main__":
    sys.exit(main())
