import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _warehouse import connect, emit, rows  # noqa: E402

con = connect()
tables = [t for (t,) in con.sql("select table_name from information_schema.tables where table_schema = 'metrics' order by 1").fetchall()]
emit({t: rows(con, f"select * from metrics.{t}") for t in tables})
