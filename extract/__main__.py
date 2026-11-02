"""python -m extract: pull my books from Hardcover, enrich them from Open
Library, and write the raw files dbt reads. Exits non-zero on any failure
so the nightly job stops before touching the site."""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from extract.hardcover import fetch_user_books, parse_user_books
from extract.openlibrary import enrich
from extract.raw_store import write_raw

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


def main() -> int:
    load_dotenv()
    token = os.getenv("HARDCOVER_API_TOKEN")
    if not token:
        print("HARDCOVER_API_TOKEN is not set (see .env.example)", file=sys.stderr)
        return 2
    extracted_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    books = parse_user_books(fetch_user_books(token), extracted_at)
    write_raw(RAW_DIR / "hardcover_books.json", books)

    ol_path = RAW_DIR / "openlibrary_books.json"
    ids = {b["hardcover_id"] for b in books}
    cached = json.loads(ol_path.read_text(encoding="utf-8")) if ol_path.exists() else []
    cached = [c for c in cached if c["hardcover_id"] in ids]
    matched = enrich(books, cached, extracted_at)
    write_raw(ol_path, matched)

    print(f"books: {len(books)}, matched on Open Library: {len(matched)}, newly matched: {len(matched) - len(cached)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
