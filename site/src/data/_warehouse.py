"""Shared by the data loaders: read-only access to the published tables.
Only the metrics and publish schemas are read, never staging or marts."""
import json
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]


def connect() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(os.getenv("WAREHOUSE_PATH", str(ROOT / "warehouse.duckdb")), read_only=True)


def rows(con: duckdb.DuckDBPyConnection, sql: str) -> list[dict]:
    rel = con.sql(sql)
    names = rel.columns
    return [dict(zip(names, r)) for r in rel.fetchall()]


def emit(data) -> None:
    # Bytes, not text: the Windows console encoding cannot hold every title.
    sys.stdout.buffer.write(json.dumps(data, default=str, ensure_ascii=False).encode("utf-8"))
