from __future__ import annotations

import json
from pathlib import Path

import pytest
import wrapped
from conftest import fixture_dir


def test_cli_prints_stats(capsys: pytest.CaptureFixture[str]) -> None:
    assert wrapped.main([fixture_dir("sample-export"), "Europe/Lisbon"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["chats"] == 40
    assert out["club"]


@pytest.mark.parametrize("tz", ["Europe/Lisbon'; DROP TABLE chats; --", "", "../etc"])
def test_cli_rejects_bad_timezone(tz: str, capsys: pytest.CaptureFixture[str]) -> None:
    assert wrapped.main([fixture_dir("sample-export"), tz]) == 2
    assert "invalid timezone" in capsys.readouterr().err


def test_cli_rejects_folder_without_export(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert wrapped.main([str(tmp_path)]) == 2
    assert "conversations.json" in capsys.readouterr().err


def test_render_quotes_paths() -> None:
    sql = wrapped.render("SELECT {{conversations}}", conversations="C:\\it's\\c.json", tz="UTC", year=2026)
    assert sql == "SELECT 'C:/it''s/c.json'"
