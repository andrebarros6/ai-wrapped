from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

FIXTURES = ["sample-export", "edge-cases"]
TIMEZONES = ["UTC", "Europe/Lisbon", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Auckland"]


def fixture_dir(name: str) -> str:
    return str(ROOT / "fixtures" / name)
