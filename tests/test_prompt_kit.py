"""The prompt-kit script (run inside the user's own Claude) must match the SQL engine exactly,
read the export straight from ZIPs, and print no titles or words."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Any

import pytest
from conftest import FIXTURES, ROOT, TIMEZONES, fixture_dir

SCRIPT = ROOT / "scripts" / "prompt_kit.py"
LOCAL_ONLY = {"chat_titles", "chattiest_day_titles", "your_top_words", "longest_chat"}
SENTINEL = "SENTINEL-PRIVATE-DO-NOT-READ@example.invalid"


def zip_fixture(fixture: str, dest: Path) -> None:
    """One ZIP per category folder, files at the ZIP root, like Claude's export."""
    for folder in Path(fixture_dir(fixture)).iterdir():
        with zipfile.ZipFile(dest / f"{folder.name}.zip", "w") as zf:
            for f in folder.rglob("*"):
                if f.is_file():
                    zf.write(f, f.relative_to(folder).as_posix())


def run_kit(folder: Path, tz: str) -> dict[str, Any]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), str(folder)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
        env={**os.environ, "WRAPPED_TZ": tz, "PYTHONIOENCODING": "utf-8"},
    )
    out: dict[str, Any] = json.loads(proc.stdout)
    return out


def expected(fixture: str, tz: str) -> dict[str, Any]:
    path = ROOT / "fixtures" / "expected" / f"{fixture}__{tz.replace('/', '-')}.json"
    g: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    shared = {k: v for k, v in g.items() if k not in LOCAL_ONLY}
    shared["longest_chat_messages"] = g["longest_chat"][0] if g["longest_chat"] else None
    return {"version": 1, "source": "full-prompt", "year": 2026, "tz": tz, **shared}


@pytest.mark.parametrize("tz", TIMEZONES)
@pytest.mark.parametrize("fixture", FIXTURES)
def test_matches_engine(fixture: str, tz: str, tmp_path: Path) -> None:
    zip_fixture(fixture, tmp_path)
    assert run_kit(tmp_path, tz) == expected(fixture, tz)


def test_prints_no_titles_and_skips_private_zips(tmp_path: Path) -> None:
    zip_fixture("edge-cases", tmp_path)
    secret = json.dumps({"email": SENTINEL})
    with zipfile.ZipFile(tmp_path / "light_metadata-000.zip", "w") as zf:
        zf.writestr("users.json", secret)
    with zipfile.ZipFile(tmp_path / "misc.zip", "w") as zf:  # private entries inside an innocent-looking ZIP
        zf.writestr("users.json", secret)
        zf.writestr("memories/m.json", secret)
    out = json.dumps(run_kit(tmp_path, "UTC"), ensure_ascii=False)
    assert SENTINEL not in out
    golden = json.loads((ROOT / "fixtures" / "expected" / "edge-cases__UTC.json").read_text(encoding="utf-8"))
    for title in golden["chat_titles"]:
        assert f'"{title}"' not in out


def test_full_prompt_embeds_current_script() -> None:
    prompt = (ROOT / "prompts" / "full.md").read_text(encoding="utf-8")
    body = SCRIPT.read_text(encoding="utf-8").replace('TZ_NAME = "UTC"', 'TZ_NAME = "YOUR/TIMEZONE"')
    assert body.strip() in prompt, "prompts/full.md is stale: run python scripts/build_prompts.py"


def test_script_is_python39_syntax() -> None:
    import ast

    ast.parse(SCRIPT.read_text(encoding="utf-8"), feature_version=(3, 9))
