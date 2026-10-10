from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "data" / "references.json"


@lru_cache(maxsize=1)
def reference_solutions() -> dict[str, str]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))
