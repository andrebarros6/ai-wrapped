"""Frozen expected outputs. The browser engine is checked against the same files (Step 3).

Regenerate after a deliberate metric change: UPDATE_GOLDEN=1 pytest tests/test_golden.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
import wrapped
from conftest import FIXTURES, ROOT, TIMEZONES, fixture_dir

EXPECTED = ROOT / "fixtures" / "expected"


def golden_path(fixture: str, tz: str) -> Path:
    return EXPECTED / f"{fixture}__{tz.replace('/', '-')}.json"


@pytest.mark.parametrize("tz", TIMEZONES)
@pytest.mark.parametrize("fixture", FIXTURES)
def test_golden(fixture: str, tz: str) -> None:
    got = wrapped.compute(fixture_dir(fixture), tz)
    path = golden_path(fixture, tz)
    if os.environ.get("UPDATE_GOLDEN"):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(got, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    assert got == json.loads(path.read_text(encoding="utf-8"))
