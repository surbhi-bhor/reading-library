import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _warehouse import connect, emit, rows  # noqa: E402

emit(rows(connect(), "select * from publish.pub_bookcase order by shelf_position"))
