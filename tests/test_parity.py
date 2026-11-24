"""The SQL engine must reproduce the v0 Python script exactly (see docs/DATA.md "Changes from v0")."""

from __future__ import annotations

import json
import subprocess
import sys
from typing import Any

import pytest
import wrapped
from conftest import FIXTURES, ROOT, TIMEZONES, fixture_dir

# Deliberate changes from v0, each documented in docs/DATA.md.
NULL_INSTEAD_OF_MISSING = {"scheduled_runs"}
# New keys that v0 never produced (local-only helpers for the cards).
NEW_KEYS = {"chattiest_day_titles"}


def run_v0(base: str, tz: str) -> dict[str, Any]:
    # -X utf8: v0 opens files with the platform encoding (cp1252 on Windows), a v0 bug.
    proc = subprocess.run(
        [sys.executable, "-X", "utf8", str(ROOT / "scripts" / "legacy" / "wrapped_v0.py"), base, tz],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    out: dict[str, Any] = json.loads(proc.stdout)
    return out


@pytest.mark.parametrize("tz", TIMEZONES)
@pytest.mark.parametrize("fixture", FIXTURES)
def test_matches_v0(fixture: str, tz: str) -> None:
    old = run_v0(fixture_dir(fixture), tz)
    new = wrapped.compute(fixture_dir(fixture), tz)
    for key in NULL_INSTEAD_OF_MISSING:
        if key not in old:
            assert new.get(key) is None
            new.pop(key, None)
    for key in NEW_KEYS:
        assert key not in old
        new.pop(key)
    assert new == json.loads(json.dumps(old))  # tuples -> lists
