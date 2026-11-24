"""The Wall: PR validation (schema, plausibility, blocklist, PR shape) and the DuckDB build."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import duckdb
import pytest
from conftest import ROOT

import wall


def entry_from_golden(name: str = "Ana", tag: str = "lisbon-builders") -> dict[str, Any]:
    """Build an entry from real engine output, the way the site does."""
    g = json.loads((ROOT / "fixtures" / "expected" / "edge-cases__UTC.json").read_text(encoding="utf-8"))
    stats: dict[str, Any] = {k: g[k] for k in wall.FIELDS["counts"]}
    stats |= {k: g[k] for k in wall.FIELDS["shares"]}
    stats["club"] = g["club"]
    stats["languages"] = sum(1 for v in g["languages_first_msg"].values() if v > 0)
    return {
        "version": 1,
        "year": 2026,
        "display_name": name,
        "tag": tag,
        "source": "claude-export",
        "stats": stats,
    }


def with_stats(**changes: Any) -> dict[str, Any]:
    e = entry_from_golden()
    e["stats"].update(changes)
    return e


def test_real_engine_output_is_a_valid_entry() -> None:
    wall.validate_entry(entry_from_golden())
    wall.validate_entry(entry_from_golden(name="José O'Neill-Silva", tag=""))


@pytest.mark.parametrize(
    ("entry", "reason"),
    [
        ({**entry_from_golden(), "opener": "hi"}, "entry keys"),
        ({**entry_from_golden(), "source": "lite-prompt"}, "not estimates"),
        ({**entry_from_golden(), "year": 2025}, "year 2026"),
        ({**entry_from_golden(), "display_name": ""}, "display_name"),
        ({**entry_from_golden(), "display_name": "x" * 33}, "display_name"),
        ({**entry_from_golden(), "display_name": "see https://spam.example"}, "display_name"),
        ({**entry_from_golden(), "tag": "Lisbon Builders"}, "tag"),
        ({**entry_from_golden(), "tag": "-edge-"}, "tag"),
        ({**entry_from_golden(), "display_name": "Sh1t Lord"}, "isn't allowed"),
        ({**entry_from_golden(), "tag": "f-u-c-k"}, "isn't allowed"),
        ({**entry_from_golden(), "display_name": "Anthropic"}, "isn't allowed"),
        (with_stats(secret="x"), "stats keys"),
        (with_stats(chats=-1), "stats.chats"),
        (with_stats(chats=True), "stats.chats"),
        (with_stats(chats=1.5), "stats.chats"),
        (with_stats(night_share=1.2), "night_share"),
        (with_stats(club="Hackers"), "club"),
        (with_stats(languages=99), "languages"),
        (with_stats(chats=0), "implausible"),
        (with_stats(active_days=400), "implausible"),
        (with_stats(longest_streak_days=999), "implausible"),
        (with_stats(your_messages=1), "implausible"),
        (with_stats(tool_calls=0), "implausible"),
        (with_stats(est_tokens_visible=0), "implausible"),
    ],
)
def test_rejects(entry: dict[str, Any], reason: str) -> None:
    with pytest.raises(wall.EntryError, match=reason):
        wall.validate_entry(entry)


@pytest.mark.parametrize("name", ["Grapefruit Fan", "Badminton Club", "Scott Hunter", "Ana Coño-Free"])
def test_blocklist_avoids_obvious_false_positives(name: str) -> None:
    assert not wall.blocked(name.replace("Coño-Free", "Silva"))


def files(mapping: dict[str, Any]) -> Any:
    return lambda path: (
        mapping[path] if isinstance(mapping[path], bytes) else json.dumps(mapping[path]).encode()
    )


def test_pr_with_one_new_entry_passes() -> None:
    wall.check_changes(
        [("A", "wall/entries/ana-1a2b3c.json")],
        files({"wall/entries/ana-1a2b3c.json": entry_from_golden()}),
        [],
    )


def test_pr_deleting_an_entry_passes() -> None:
    wall.check_changes([("D", "wall/entries/ana-1a2b3c.json")], files({}), [])


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ([], "no changes"),
        ([("M", "app/page.tsx")], "may only touch"),
        ([("A", "wall/entries/sub/ana.json")], "may only touch"),
        ([("A", "wall/entries/Ana_Smith.json")], "file name"),
        ([("A", "wall/entries/ana-1.json"), ("A", "wall/entries/bob-2.json")], "one entry per pull request"),
    ],
)
def test_pr_shape_rules(changes: list[tuple[str, str]], reason: str) -> None:
    content = {p: entry_from_golden() for _, p in changes}
    with pytest.raises(wall.EntryError, match=reason):
        wall.check_changes(changes, files(content), [])


def test_pr_rejects_oversized_and_broken_files() -> None:
    path = "wall/entries/ana-1a2b3c.json"
    with pytest.raises(wall.EntryError, match="too large"):
        wall.check_changes([("A", path)], files({path: b"{" + b" " * 9000 + b"}"}), [])
    with pytest.raises(wall.EntryError, match="valid JSON"):
        wall.check_changes([("A", path)], files({path: b"{nope"}), [])


def test_duplicate_name_and_tag_must_edit_their_existing_file() -> None:
    existing = [{**entry_from_golden(), "_id": "ana-000000"}]
    path = "wall/entries/ana-1a2b3c.json"
    with pytest.raises(wall.EntryError, match="already on the Wall"):
        wall.check_changes([("A", path)], files({path: entry_from_golden()}), existing)
    # Editing your own file is fine.
    wall.check_changes(
        [("M", "wall/entries/ana-000000.json")],
        files({"wall/entries/ana-000000.json": entry_from_golden()}),
        existing,
    )


def write_entries(folder: Path, n: int) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for i in range(n):
        e = copy.deepcopy(entry_from_golden(name=f"Person {i}", tag="team-a" if i % 2 else "team-b"))
        e["stats"]["web_searches"] = i  # 0..n-1, so percentiles are easy to check
        e["stats"]["tool_calls"] = max(e["stats"]["tool_calls"], i)
        (folder / f"person-{i:03d}.json").write_text(json.dumps(e), encoding="utf-8")


def test_build_small_wall_has_no_ranks_yet(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(wall, "ENTRIES", tmp_path / "entries")
    write_entries(tmp_path / "entries", 3)
    out = wall.build(tmp_path / "public", tmp_path / "data")
    assert out["count"] == 3
    assert {t["tag"]: t["members"] for t in out["tags"]} == {"team-b": 2, "team-a": 1}
    assert out["entries"][0]["display_name"].startswith("Person")
    dist = json.loads((tmp_path / "public" / "distribution.json").read_text(encoding="utf-8"))
    assert dist == {"version": 1, "count": 3, "min_entries": 20, "metrics": None}


def test_build_computes_percentiles_and_open_dataset(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(wall, "ENTRIES", tmp_path / "entries")
    write_entries(tmp_path / "entries", 25)
    wall.build(tmp_path / "public", tmp_path / "data")
    dist = json.loads((tmp_path / "public" / "distribution.json").read_text(encoding="utf-8"))
    web = dist["metrics"]["web_searches"]
    assert len(web) == 101
    assert web[0] == 0 and web[100] == 24 and web[50] == 12
    assert web == sorted(web)
    rows = duckdb.sql(
        f"SELECT count(*), max(web_searches) FROM '{(tmp_path / 'data' / 'wall.parquet').as_posix()}'"
    )
    assert rows.fetchone() == (25, 24)


def test_committed_wall_files_are_up_to_date(tmp_path: Path) -> None:
    """public/wall/*.json must match the entries (the build-wall Action keeps them in sync)."""
    wall.build(tmp_path / "public", tmp_path / "data")
    for name in ("wall.json", "distribution.json"):
        got = json.loads((tmp_path / "public" / name).read_text(encoding="utf-8"))
        committed = json.loads((ROOT / "public" / "wall" / name).read_text(encoding="utf-8"))
        got.pop("generated", None)
        committed.pop("generated", None)
        assert got == committed, f"public/wall/{name} is stale: run python scripts/wall.py build"


def test_validate_command_on_a_real_git_branch(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """What the PR check runs: base branch rules against a PR branch in another checkout."""
    import subprocess

    def git(*args: str) -> None:
        subprocess.run(
            ["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", *args],
            cwd=tmp_path,
            check=True,
        )

    git("init", "-q", "-b", "main")
    (tmp_path / "wall" / "entries").mkdir(parents=True)
    (tmp_path / "wall" / "entries" / ".gitkeep").write_text("")
    git("add", ".")
    git("commit", "-q", "-m", "base")
    git("checkout", "-q", "-b", "join")
    (tmp_path / "wall" / "entries" / "ana-1a2b3c.json").write_text(
        json.dumps(entry_from_golden()), encoding="utf-8"
    )
    git("add", ".")
    git("commit", "-q", "-m", "join the wall")
    assert wall.cmd_validate("main", tmp_path) == 0

    (tmp_path / "README.md").write_text("sneaky")
    git("add", ".")
    git("commit", "-q", "-m", "also change code")
    assert wall.cmd_validate("main", tmp_path) == 1
    assert "may only touch" in capsys.readouterr().out
