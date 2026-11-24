"""The CLI must never open private parts of an export."""

from __future__ import annotations

import builtins
import json
import shutil
from pathlib import Path
from typing import Any

import pytest
import wrapped
from conftest import fixture_dir

SENTINEL = "SENTINEL-PRIVATE-DO-NOT-READ@example.invalid"
FORBIDDEN = ("light_metadata", "memories", "artifact_data", "frames")


def add_decoys(root: Path) -> None:
    for rel in (
        "light_metadata-000/users.json",
        "light_metadata-000/login_history.json",
        "memories-000/memories/m.json",
        "artifact_data-000/artifacts/x.json",
    ):
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"email": SENTINEL, "ip": "203.0.113.7"}), encoding="utf-8")
    (root / "frames-000" / "artifacts" / "art0" / "artifact.json").write_text(
        json.dumps({"secret": SENTINEL}), encoding="utf-8"
    )


def test_private_files_are_never_opened(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    export = tmp_path / "export"
    shutil.copytree(fixture_dir("edge-cases"), export)
    add_decoys(export)

    opened: list[str] = []
    real_open = builtins.open

    def spy(file: Any, *args: Any, **kwargs: Any) -> Any:
        opened.append(str(file))
        return real_open(file, *args, **kwargs)

    monkeypatch.setattr(builtins, "open", spy)
    out = wrapped.compute(str(export), "UTC")
    monkeypatch.undo()

    assert opened, "spy saw no reads at all"
    assert [p for p in opened if any(f in p for f in FORBIDDEN)] == []
    assert SENTINEL not in json.dumps(out)
    assert out == wrapped.compute(fixture_dir("edge-cases"), "UTC")
