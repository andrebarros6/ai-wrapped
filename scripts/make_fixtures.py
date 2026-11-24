"""Generate fixtures/edge-cases: a small synthetic export that exercises tricky cases.

All data is invented. Run: python scripts/make_fixtures.py
(The light_metadata decoy is NOT generated here: tests create it in a temp dir, because the
repo guard forbids committing anything named light_metadata.)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

OUT = Path(__file__).resolve().parent.parent / "fixtures" / "edge-cases"

_n = 0


def uid(prefix: str) -> str:
    global _n
    _n += 1
    return f"{prefix}-{_n:04d}"


AUTO = "<auto>"  # parent = previous message in the chat, as in real exports


def msg(
    sender: str,
    ts: str,
    text: str = "",
    parent: str | None = AUTO,
    content: list[Any] | None = None,
    files: int = 0,
    attachments: int = 0,
    mid: str | None = None,
) -> dict[str, Any]:
    if content is None:
        content = [{"type": "text", "text": text}]
    return {
        "uuid": mid or uid("m"),
        "text": text,
        "sender": sender,
        "created_at": ts,
        "updated_at": ts,
        "attachments": [{"file_name": f"a{i}.txt"} for i in range(attachments)],
        "files": [{"file_name": f"f{i}.png"} for i in range(files)],
        "parent_message_uuid": parent,
        "content": content,
    }


def chat(name: str | None, ts: str, messages: list[dict[str, Any]]) -> dict[str, Any]:
    prev = None
    for m in messages:
        if m["parent_message_uuid"] == AUTO:
            m["parent_message_uuid"] = prev
        prev = m["uuid"]
    return {
        "uuid": uid("c"),
        "name": name,
        "summary": "",
        "created_at": ts,
        "updated_at": ts,
        "account": {"uuid": "fake"},
        "chat_messages": messages,
    }


def tool(name: str | None) -> dict[str, Any]:
    return {"type": "tool_use", "name": name, "input": {}}


def conversations() -> list[dict[str, Any]]:
    c: list[dict[str, Any]] = []

    # Timezone year boundaries: in 2026 for UTC/Lisbon/LA, 2027 for Auckland.
    c.append(
        chat(
            "New year's eve plan",
            "2026-12-31T23:30:00Z",
            [
                msg("human", "2026-12-31T23:30:00Z", "what can I cook for new year with friends"),
                msg("assistant", "2026-12-31T23:31:00Z", "A few ideas — quick ones — and one slow one."),
            ],
        )
    )
    # 2025 in UTC/Lisbon, 2026 in Auckland and Kolkata.
    c.append(
        chat(
            "Last minute 2025",
            "2025-12-31T20:30:00Z",
            [
                msg("human", "2025-12-31T20:30:00Z", "how do I write a good retro for this year"),
                msg("assistant", "2025-12-31T20:31:00Z", "Start with what went well."),
            ],
        )
    )

    # Unicode, emoji, multilingual thanks and whole-word boundaries.
    c.append(
        chat(
            "Obrigada 😀",
            "2026-02-10T09:00:00Z",
            [
                msg(
                    "human",
                    "2026-02-10T09:00:00Z",
                    "Obrigada! Não sei como 😀 thank you, thanks!thanks "
                    "éthanks _thanks thanks2 merci. gracias—danke",
                ),
                msg("assistant", "2026-02-10T09:01:00Z", "De nada — sempre — às ordens."),
                msg("human", "2026-02-10T09:02:00Z", "thank  you (two spaces) and Thank You and OBRIGADO"),
            ],
        )
    )

    # Edits and regenerations (sibling branches) + thinking + tools.
    root = "m-root"
    c.append(
        chat(
            "Fix my SQL query",
            "2026-03-29T01:30:00Z",
            [  # DST switch in Lisbon
                msg("human", "2026-03-29T01:30:00Z", "why is my join slow", parent=None, mid=root),
                msg(
                    "assistant",
                    "2026-03-29T01:31:00Z",
                    parent=root,
                    content=[
                        {"type": "thinking", "thinking": "Probably a missing index."},
                        tool("web_search"),
                        {"type": "tool_result", "content": []},
                        {"type": "text", "text": "Add an index — then check the plan."},
                    ],
                ),
                msg(
                    "assistant",
                    "2026-03-29T01:32:00Z",
                    parent=root,
                    content=[
                        tool("bash_tool"),
                        {"type": "text", "text": "Regenerated — same answer."},
                    ],
                ),
                msg(
                    "assistant",
                    "2026-03-29T01:33:00Z",
                    parent=root,
                    content=[
                        tool("conversation_search"),
                        tool("create_file"),
                        {"type": "text", "text": "Third try."},
                    ],
                ),
                msg("human", "2026-03-29T01:34:00Z", "why is my join so slow (edited)", parent=None),
            ],
        )
    )

    # Agent-style tools, unnamed tool, files and attachments; DST switch back.
    c.append(
        chat(
            "Build the landing page",
            "2026-10-25T01:30:00Z",
            [
                msg(
                    "human",
                    "2026-10-25T01:30:00Z",
                    "build the landing page for the product",
                    files=2,
                    attachments=1,
                ),
                msg(
                    "assistant",
                    "2026-10-25T01:31:00Z",
                    content=[
                        tool("Bash"),
                        tool("Write"),
                        tool("Edit"),
                        tool(None),
                        tool("memory_user_edits"),
                        tool("recent_chats"),
                        tool("present_files"),
                        {"type": "text", "text": "Done."},
                    ],
                ),
            ],
        )
    )

    # Empty first human message: language vote uses the next non-empty one.
    c.append(
        chat(
            "Receita de bacalhau",
            "2026-04-02T19:00:00Z",
            [
                msg("human", "2026-04-02T19:00:00Z", ""),
                msg(
                    "human",
                    "2026-04-02T19:01:00Z",
                    "como é que faço bacalhau para uma festa? não tenho forno",
                ),
                msg("assistant", "2026-04-02T19:02:00Z", "Bacalhau à Brás — sem forno."),
            ],
        )
    )

    # French, Spanish and English chats (Polyglots needs 3+ chats per language).
    for i in range(3):
        c.append(
            chat(
                f"Trouver un appartement {i}",
                f"2026-05-0{i + 1}T22:15:00Z",
                [
                    msg(
                        "human",
                        f"2026-05-0{i + 1}T22:15:00Z",
                        "je cherche un appartement pour mon travail avec vous",
                    ),
                    msg("assistant", f"2026-05-0{i + 1}T22:16:00Z", "Voici quelques pistes."),
                ],
            )
        )
    for i in range(3):
        c.append(
            chat(
                f"Viaje a Almería {i}",
                f"2026-06-1{i}T23:40:00Z",
                [
                    msg(
                        "human", f"2026-06-1{i}T23:40:00Z", "hola, tengo una pregunta pero estoy muy cansado"
                    ),
                    msg("assistant", f"2026-06-1{i}T23:41:00Z", "Claro."),
                ],
            )
        )

    # Longest-chat tie (same count, title decides) and a long message (excluded from top words).
    long_text = "dashboard " * 40
    for name in ("Alpha metrics", "Zeta metrics"):
        c.append(
            chat(
                name,
                "2026-07-07T14:00:00Z",
                [
                    msg("human", "2026-07-07T14:00:00Z", "dashboard metrics dashboard pipeline"),
                    msg("assistant", "2026-07-07T14:01:00Z", "ok"),
                    msg("human", "2026-07-07T14:02:00Z", long_text),
                    msg("assistant", "2026-07-07T14:03:00Z", "ok"),
                    msg("human", "2026-07-07T14:04:00Z", "pipeline metrics"),
                    msg("assistant", "2026-07-07T14:05:00Z", "ok"),
                ],
            )
        )

    # Streak of 3 consecutive days, weekend messages.
    for d in ("08", "09", "10"):  # Sat 8, Sun 9, Mon 10 Aug 2026
        c.append(
            chat(
                f"Daily note {d}",
                f"2026-08-{d}T08:00:00Z",
                [
                    msg("human", f"2026-08-{d}T08:00:00Z", "plan my day with focus blocks"),
                    msg("assistant", f"2026-08-{d}T08:01:00Z", "Here's a plan."),
                ],
            )
        )

    # Edge shapes: no messages, null title.
    c.append(chat("Empty chat", "2026-09-01T10:00:00Z", []))
    c.append(
        chat(
            None,
            "2026-09-02T10:00:00Z",
            [
                msg("human", "2026-09-02T10:00:00Z", "the and you for with"),
            ],
        )
    )
    return c


def write(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    write(OUT / "conversations-000" / "conversations.json", conversations())
    for i, ts in enumerate(["2026-01-15T10:00:00Z", "2026-06-01T10:00:00Z", "2025-12-31T23:30:00Z"]):
        write(
            OUT / "projects-000" / "projects" / f"p{i}.json",
            {"uuid": f"p{i}", "name": f"Project {i}", "description": "", "created_at": ts, "docs": []},
        )
    design: list[dict[str, Any]] = [
        {"title": "Card ideas", "project": {"uuid": "dp1", "name": "Wrapped"}, "messages": [{"text": "x"}]},
        {"title": "More cards", "project": {"uuid": "dp1", "name": "Wrapped"}, "messages": [{"text": "y"}]},
        {"title": "Logo", "project": {"uuid": "dp2", "name": "Brand"}, "messages": []},
        {"title": "Loose sketch", "project": None, "messages": [{"text": "z"}]},
    ]
    for i, d in enumerate(design):
        write(OUT / "design_chats-000" / "design_chats" / f"d{i}.json", {"uuid": f"d{i}", **d})
    for i in range(3):
        write(OUT / "frames-000" / "artifacts" / f"art{i}" / "artifact.json", {"id": f"art{i}"})
    write(OUT / "frames-000" / "artifacts" / "not-an-artifact" / "notes.json", {})
    write(
        OUT / "claude_code_cloud-000" / "claude_code_cloud" / "routine_runs.json",
        {"claude_code_cloud": [{"id": f"run{i}"} for i in range(5)]},
    )
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
