"""AI Wrapped 2026: prompt-kit script. Runs inside your own Claude chat (code execution).

Reads the Claude export ZIPs you attached and prints ONLY aggregate numbers as JSON: no chat
titles, no message text. Never opens light_metadata, memories, artifact_data or artifact files.
Python 3.9+ standard library only. Same definitions as the website and the CLI (see sql/ on GitHub).

Set TZ_NAME to your timezone, e.g. "Europe/Lisbon".
"""

import collections
import json
import os
import re
import sys
import zipfile
from datetime import datetime
from zoneinfo import ZoneInfo

TZ_NAME = "UTC"
YEAR = 2026
SEARCH_DIRS = ["/mnt/user-data/uploads", "/mnt/data", "."]

PRIVATE = re.compile(
    r"(^|/)(users|login_history)\.json$|(^|/)light_metadata|(^|/)memories(/|$)|(^|/)artifacts/[^/]+/data(/|$)"
)
SKIP_ZIPS = re.compile(r"light_metadata|memories|artifact_data", re.I)
STOP_LANG = {
    "pt": {
        "não",
        "que",
        "para",
        "uma",
        "como",
        "está",
        "você",
        "tens",
        "queres",
        "obrigado",
        "também",
        "isso",
    },
    "fr": {"je", "est", "les", "pour", "une", "pas", "avec", "vous", "mon", "dans", "merci"},
    "es": {"que", "para", "una", "pero", "estoy", "tengo", "muy", "gracias", "también", "hola"},
    "en": {"the", "and", "you", "for", "with", "this", "what", "how", "can", "is", "my"},
}
AGENT_TOOLS = {"Bash", "Write", "Edit", "Read", "SendUserFile", "Artifact", "TaskCreate"}
THANKS = re.compile(r"\b(thanks|thank you|obrigad[oa]|merci|gracias|danke)\b")


def find_zips(dirs):
    found = []
    for d in dirs:
        if not os.path.isdir(d):
            continue
        for root, subdirs, files in os.walk(d):
            if root[len(d) :].count(os.sep) >= 2:
                subdirs[:] = []
            found += [
                os.path.join(root, f) for f in files if f.lower().endswith(".zip") and not SKIP_ZIPS.search(f)
            ]
        if found:
            break
    return sorted(set(found))


def read_export(zips):
    conv, projects, design, artifacts, runs = None, [], [], 0, None
    for path in zips:
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                n = name.replace("\\", "/")
                if PRIVATE.search(n):
                    continue
                if re.search(r"(^|/)conversations\.json$", n):
                    if conv is None:
                        conv = json.loads(zf.read(name).decode("utf-8"))
                elif re.search(r"(^|/)projects/[^/]+\.json$", n):
                    projects.append(json.loads(zf.read(name).decode("utf-8")).get("created_at"))
                elif re.search(r"(^|/)design_chats/[^/]+\.json$", n):
                    design.append(json.loads(zf.read(name).decode("utf-8")))
                elif re.search(r"(^|/)claude_code_cloud/routine_runs\.json$", n):
                    runs = len(json.loads(zf.read(name).decode("utf-8"))["claude_code_cloud"])
                elif re.search(r"(^|/)artifacts/[^/]+/artifact\.json$", n):
                    artifacts += 1
    if conv is None:
        sys.exit("conversations.json not found: attach conversations-000.zip")
    return conv, projects, design, artifacts, runs


def compute(conv, projects, design, artifacts, runs, tz_name):
    tz = ZoneInfo(tz_name)

    def ts(s):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(tz)

    conv = [c for c in conv if ts(c["created_at"]).year == YEAR]
    months, hours, wd = collections.Counter(), collections.Counter(), collections.Counter()
    days, tools, langs = set(), collections.Counter(), collections.Counter()
    day, daytopics, kids = collections.Counter(), collections.defaultdict(set), collections.Counter()
    hmsg = amsg = hchars = achars = tchars = thinking = attach = thanks = em = oneshot = 0
    lens = []
    for c in conv:
        n, first, hm = 0, None, 0
        for m in c["chat_messages"]:
            t = ts(m["created_at"])
            n += 1
            attach += len(m.get("files") or []) + len(m.get("attachments") or [])
            kids[(c["uuid"], m.get("parent_message_uuid"), m["sender"])] += 1
            if m["sender"] == "human":
                hm += 1
                hmsg += 1
                months[t.month] += 1
                hours[t.hour] += 1
                wd[t.strftime("%a")] += 1
                days.add(t.date())
                day[t.date()] += 1
                daytopics[t.date()].add(c.get("name") or "")
                txt = m.get("text") or ""
                hchars += len(txt)
                first = first or txt
                thanks += len(THANKS.findall(txt.lower()))
            else:
                amsg += 1
            for b in m["content"]:
                if b["type"] == "text" and m["sender"] != "human":
                    achars += len(b.get("text") or "")
                    em += (b.get("text") or "").count("\u2014")
                elif b["type"] == "thinking":
                    thinking += 1
                    tchars += len(b.get("thinking") or "")
                elif b["type"] == "tool_use":
                    tools[b.get("name")] += 1
        lens.append((n, c["name"]))
        oneshot += hm == 1
        if first:
            ws = set(re.findall(r"[a-zà-ú]+", first.lower()))
            sc = {k: len(ws & v) for k, v in STOP_LANG.items()}
            if max(sc.values()) > 0:
                langs[max(sc, key=sc.get)] += 1

    d = sorted(days)
    best = cur = 1
    for i in range(1, len(d)):  # (no zip(strict=): keeps this runnable on Python 3.9)
        cur = cur + 1 if (d[i] - d[i - 1]).days == 1 else 1
        best = max(best, cur)

    def cat(keys):
        return sum(v for k, v in tools.items() if any(x in (k or "").lower() for x in keys))

    agent = sum(
        1
        for c in conv
        if any(
            b["type"] == "tool_use" and b.get("name") in AGENT_TOOLS
            for m in c["chat_messages"]
            for b in m["content"]
        )
    )
    out = {
        "chats": len(conv),
        "your_messages": hmsg,
        "claude_messages": amsg,
        "active_days": len(days),
        "longest_streak_days": best,
        "est_tokens_visible": round((hchars + achars + tchars) / 4),
        "your_words": round(hchars / 5.5),
        "claude_words": round(achars / 5.5),
        "thinking_blocks": thinking,
        "tool_calls": sum(tools.values()),
        "web_searches": cat(["search"]) - tools.get("conversation_search", 0),
        "code_runs": cat(["bash"]),
        "files_created": cat(["create_file", "write", "present_files", "senduserfile"]),
        "memory_lookups": cat(["memory", "conversation_search", "recent_chats"]),
        "agent_style_chats": agent,
        "files_uploaded": attach,
        "by_month": {datetime(2026, k, 1).strftime("%b"): v for k, v in sorted(months.items())},
        "by_hour": {str(k): v for k, v in sorted(hours.items())},
        "by_weekday": dict(wd),
        "languages_first_msg": dict(langs),
        "longest_chat_messages": max(lens)[0] if lens else None,
        "top_tools": [list(x) for x in tools.most_common(8)],
        "design_chats": len(design),
        "design_chats_with_msgs": sum(1 for x in design if x.get("messages")),
        "design_projects": len({x["project"].get("name") for x in design if x.get("project")}),
        "projects_total": len(projects),
        f"projects_created_{YEAR}": sum(1 for p in projects if p and ts(p).year == YEAR),
        "artifacts": artifacts,
        "scheduled_runs": runs,
    }
    if day:
        top, msgs = day.most_common(1)[0]
        out["chattiest_day"] = {"date": top.isoformat(), "messages": msgs, "topics": len(daytopics[top])}
    else:
        out["chattiest_day"] = None
    out["avg_messages_per_active_day"] = round(hmsg / max(1, len(days)), 1)
    out["retries"] = sum(v - 1 for v in kids.values() if v > 1)
    out["thanks"] = thanks
    out["em_dashes_from_claude"] = em
    out["one_shot_chats"] = oneshot
    night = sum(v for h, v in hours.items() if h >= 22 or h < 5)
    out["night_share"] = round(night / max(1, hmsg), 3)
    out["weekend_share"] = round((wd.get("Sat", 0) + wd.get("Sun", 0)) / max(1, hmsg), 3)
    n = max(1, len(conv))
    scores = {
        "Researchers": out["web_searches"] / n / 2.0,
        "Builders": (out["files_created"] + artifacts) / n / 0.7,
        "Coders": out["code_runs"] / n / 0.8,
        "Night Shift": out["night_share"] / 0.15,
        "Polyglots": len([k for k, v in langs.items() if v >= 3]) / 3,
        "Talkers": (hmsg / n) / 6,
    }
    out["club"] = max(scores, key=scores.get)
    out["club_scores"] = {k: round(v, 2) for k, v in scores.items()}
    return out


def main(argv):
    tz_name = os.environ.get("WRAPPED_TZ") or TZ_NAME
    zips = find_zips(argv or SEARCH_DIRS)
    stats = compute(*read_export(zips), tz_name)
    print(
        json.dumps(
            {"version": 1, "source": "full-prompt", "year": YEAR, "tz": tz_name, **stats}, ensure_ascii=False
        )
    )


if __name__ == "__main__":
    main(sys.argv[1:])
