"""Builds prompts/full.md from scripts/prompt_kit.py, so the prompt always runs the tested script.

Run after changing prompt_kit.py:  python scripts/build_prompts.py
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TEMPLATE = """# AI Wrapped 2026: full prompt kit (exact numbers, in your own Claude)

Rather not drop your export on a website? Run the analysis in your own Claude account instead.
Claude runs a small script on your export and prints only totals: no chat titles, no message text.
It's the same maths as the site and the command line, tested against the same files.

## Steps (about 5 minutes)
1. On claude.ai (web or desktop): **Settings → Privacy → Export data**. Wait for the email.
2. Download `conversations-000.zip` (the one that matters). `projects-000.zip`, `design_chats-000.zip`
   and `claude_code_cloud-000.zip` add more.
   **Don't attach** `light_metadata` (your email, phone and login IPs), `memories`,
   `artifact_data` or `frames`. The script skips them anyway.
3. Make sure code execution is on: **Settings → Capabilities → Code execution and file creation**.
4. Open a new chat, attach the ZIPs, and paste everything in the box below.
   Change `YOUR/TIMEZONE` to yours, e.g. `Europe/Lisbon` or `America/New_York`.
5. Copy the JSON Claude replies with and paste it at **barrosbuilds.com/wrapped/import**.

## Prompt

````
Use code execution to run the Python script below, exactly as written, on the ZIP files I attached.
Only change TZ_NAME to my timezone if I haven't. Don't open, read or summarise my chats yourself.
Reply with only the JSON the script prints, in one code block, and nothing else.

```python
{script}
```
````
"""


def main() -> None:
    script = (ROOT / "scripts" / "prompt_kit.py").read_text(encoding="utf-8").strip()
    script = script.replace('TZ_NAME = "UTC"', 'TZ_NAME = "YOUR/TIMEZONE"')
    (ROOT / "prompts" / "full.md").write_text(TEMPLATE.format(script=script), encoding="utf-8", newline="\n")
    print("wrote prompts/full.md")


if __name__ == "__main__":
    main()
