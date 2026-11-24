"""The committed edge-case fixture must be exactly what the generator produces."""

from __future__ import annotations

from pathlib import Path

import make_fixtures
import pytest
from conftest import ROOT


def files(root: Path) -> dict[str, bytes]:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}


def test_generator_reproduces_committed_fixture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(make_fixtures, "OUT", tmp_path)
    monkeypatch.setattr(make_fixtures, "_n", 0)
    make_fixtures.main()
    assert files(tmp_path) == files(ROOT / "fixtures" / "edge-cases")
