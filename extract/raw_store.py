"""Writes raw extract files. An empty extract never replaces a good file:
the Hardcover library is never really empty, so zero rows means the API
failed, and keeping yesterday's file is what keeps history safe."""
import json
import os
from pathlib import Path


class EmptyExtractError(RuntimeError):
    pass


def write_raw(path: Path, rows: list[dict]) -> int:
    if not rows:
        raise EmptyExtractError(f"refusing to overwrite {path} with an empty extract")
    if all("hardcover_id" in r for r in rows):
        # Stable order keeps the data commits small and readable.
        rows = sorted(rows, key=lambda r: r["hardcover_id"])
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, path)  # atomic: a crash never leaves half a file
    return len(rows)
