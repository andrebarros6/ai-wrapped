"""Targeted checks of the SQL model, macros and edge cases."""

from __future__ import annotations

from typing import Any

import pytest
import wrapped
from conftest import fixture_dir


@pytest.fixture(scope="module")
def edge() -> dict[str, Any]:
    return wrapped.compute(fixture_dir("edge-cases"), "UTC")


@pytest.mark.parametrize(
    ("x", "n", "expected"),
    [
        (2.5, 0, 2),
        (3.5, 0, 4),
        (-2.5, 0, -2),
        (2.6, 0, 3),
        (0.125, 2, 0.12),
        (0.375, 2, 0.38),
        (1.25, 1, 1.2),
    ],
)
def test_py_round_is_half_even(x: float, n: int, expected: float) -> None:
    con, _ = wrapped.build_model(fixture_dir("sample-export"))
    try:
        row = con.execute("SELECT py_round(?::DOUBLE, ?)", [x, n]).fetchone()
        assert row is not None
        assert row[0] == expected == round(x, n)
    finally:
        con.close()


def test_thanks_whole_words_unicode(edge: dict[str, Any]) -> None:
    # Counted: obrigada, thank you, thanks, thanks (after "!"), merci, gracias, danke, "Thank You", OBRIGADO.
    # Not counted: éthanks, _thanks, thanks2, "thank  you" (two spaces).
    assert edge["thanks"] == 9


def test_retries_count_edits_and_regenerations(edge: dict[str, Any]) -> None:
    assert edge["retries"] == 3  # 2 regenerations + 1 edit


def test_timezone_moves_chats_across_the_year() -> None:
    utc = wrapped.compute(fixture_dir("edge-cases"), "UTC")
    akl = wrapped.compute(fixture_dir("edge-cases"), "Pacific/Auckland")
    assert utc["chats"] == akl["chats"] == 18  # one chat leaves 2026 in Auckland, another enters
    assert utc["projects_created_2026"] == 2
    assert akl["projects_created_2026"] == 3


def test_surfaces(edge: dict[str, Any]) -> None:
    assert edge["design_chats"] == 4
    assert edge["design_chats_with_msgs"] == 3
    assert edge["design_projects"] == 2
    assert edge["projects_total"] == 3
    assert edge["artifacts"] == 3  # the folder without artifact.json doesn't count
    assert edge["scheduled_runs"] == 5


def test_missing_surfaces_give_zero_or_null() -> None:
    s = wrapped.compute(fixture_dir("sample-export"), "UTC")
    assert s["design_chats"] == 0
    assert s["artifacts"] == 0
    assert s["scheduled_runs"] is None


def test_tools_and_languages(edge: dict[str, Any]) -> None:
    assert edge["web_searches"] == 1  # conversation_search is memory, not web
    assert edge["memory_lookups"] == 3
    assert edge["agent_style_chats"] == 1
    assert edge["languages_first_msg"] == {"en": 7, "pt": 2, "fr": 3, "es": 3}
    assert edge["longest_chat"] == [6, "Zeta metrics"]  # tie broken by title, like Python max()
    assert edge["longest_streak_days"] == 3
