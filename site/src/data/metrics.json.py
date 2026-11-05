import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _warehouse import connect, emit, rows  # noqa: E402

con = connect()
tables = [t for (t,) in con.sql("select table_name from information_schema.tables where table_schema = 'metrics' order by 1").fetchall()]
# Sorted on every column, so the same data always gives the same file (and the same hashed name).
emit({t: rows(con, f"select * from metrics.{t} order by all") for t in tables})
