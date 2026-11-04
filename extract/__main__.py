"""python -m extract: pull my books from Hardcover, enrich them from Open
Library, pull the articles I have read from Raindrop and the books visitors
recommend from Supabase, and write the raw
files dbt reads. Exits non-zero if the books fail, so the nightly job
stops before touching the site; articles and recommendations are optional
and never stop it."""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

from extract.hardcover import fetch_user_books, parse_user_books
from extract.openlibrary import add_descriptions, enrich
from extract.raindrop import fetch_bookmarks, parse_raindrops, update_articles
from extract.recommendations import fetch_all, parse_recommendations, update_recommendations
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
    add_descriptions(matched, books)
    write_raw(ol_path, matched)

    print(f"books: {len(books)}, matched on Open Library: {len(matched)}, newly matched: {len(matched) - len(cached)}")

    # Articles are optional: without a token, or if Raindrop is down, the
    # books still update and yesterday's articles stay as they were.
    articles_path = RAW_DIR / "raindrop_articles.json"
    raindrop_token = os.getenv("RAINDROP_TOKEN")
    if not raindrop_token:
        print("articles: RAINDROP_TOKEN not set, keeping saved articles")
        update_articles(articles_path, [])
    else:
        try:
            articles = parse_raindrops(fetch_bookmarks(raindrop_token), extracted_at)
            print(f"articles: {update_articles(articles_path, articles)}")
        except requests.RequestException as e:
            print(f"articles: Raindrop failed ({e}), keeping saved articles", file=sys.stderr)
            update_articles(articles_path, [])

    # Recommendations are optional too: without Supabase settings, or if it
    # is down, yesterday's file stays (or an empty one on a first run).
    recs_path = RAW_DIR / "recommendations.json"
    sb_url, sb_key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not (sb_url and sb_key):
        print("recommendations: SUPABASE_URL or SUPABASE_SERVICE_KEY not set, keeping saved ones")
        if not recs_path.exists():
            update_recommendations(recs_path, [])
        return 0
    try:
        saved = json.loads(recs_path.read_text(encoding="utf-8")) if recs_path.exists() else []
        recs = parse_recommendations(fetch_all(sb_url, sb_key), saved, extracted_at)
    except requests.RequestException as e:
        print(f"recommendations: Supabase failed ({e}), keeping saved ones", file=sys.stderr)
        if not recs_path.exists():
            update_recommendations(recs_path, [])
        return 0
    n = update_recommendations(recs_path, recs)
    print(f"recommendations: {n} on the shelf")
    return 0

if __name__ == "__main__":
    sys.exit(main())
