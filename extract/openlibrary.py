"""Covers, page counts, subjects and English author names from Open
Library. Search logic copied from the main project's openlib_op.py.
Matches are cached in the raw file, so each book is searched once."""
import logging
import re
import time
from typing import Optional

import requests

from extract.english import author_matches, english_author_name
from extract.hardcover import clean_description

SEARCH_URL = "https://openlibrary.org/search.json"
FIELDS = "key,title,author_name,author_alternative_name,first_publish_year,subject,number_of_pages_median,cover_i,publisher"
HEADERS = {"User-Agent": "reading-library (personal reading site)"}
PAUSE_SECONDS = 0.5  # Open Library courtesy between requests

log = logging.getLogger(__name__)


def search_openlibrary(title: str, author: Optional[str]) -> Optional[dict]:
    """Title search first, then a free-text title + author search, which
    finds translated titles indexed under the original-script author."""
    main_title = title.split(":")[0].strip()
    searches = [{"title": main_title}]
    if author:
        searches.append({"q": f"{main_title} {author}"})
    for params in searches:
        time.sleep(PAUSE_SECONDS)
        r = requests.get(SEARCH_URL, params={**params, "limit": 5, "fields": FIELDS}, headers=HEADERS, timeout=20)
        r.raise_for_status()
        docs = r.json().get("docs", [])
        if not author:
            return docs[0] if docs else None
        for doc in docs:
            # Alternative names too: Open Library may list only the
            # original-script name ('村上春樹') under author_name.
            if author_matches(author, (doc.get("author_name") or []) + (doc.get("author_alternative_name") or [])):
                return doc
    return None


def to_row(hardcover_id: str, doc: dict, extracted_at: str) -> dict:
    return {
        "hardcover_id": hardcover_id,
        "ol_key": doc.get("key"),
        "author_name": english_author_name(doc.get("author_name") or [], doc.get("author_alternative_name") or []),
        "first_publish_year": doc.get("first_publish_year"),
        "page_count": doc.get("number_of_pages_median"),
        "subjects": doc.get("subject") or [],
        "cover_id": doc.get("cover_i"),
        "publisher": (doc.get("publisher") or [None])[0],
        "extracted_at": extracted_at,
    }


def plain_description(text: Optional[str]) -> Optional[str]:
    """Open Library descriptions are Markdown, often with a source note
    under a '----' rule: keep the words only."""
    if not text:
        return None
    text = re.split(r"\n\s*-{3,}", text)[0]
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)|\[([^\]]*)\]\[\d+\]", lambda m: m.group(1) or m.group(2) or "", text)
    return clean_description(text.replace("**", "").replace("__", ""))


def add_descriptions(rows: list[dict], books: list[dict]) -> None:
    """For books Hardcover has no blurb for, take the Open Library work's.
    Looked up once: a stored None means Open Library had none either."""
    blank = {b["hardcover_id"] for b in books if not b.get("description")}
    for row in rows:
        if "description" in row:
            continue
        # Every row carries the key, so dbt always finds the column.
        # shortcut: a book that later loses its Hardcover blurb is not looked up again; delete its row to retry.
        if row["hardcover_id"] not in blank or not row.get("ol_key"):
            row["description"] = None
            continue
        try:
            time.sleep(PAUSE_SECONDS)
            r = requests.get(f"https://openlibrary.org{row['ol_key']}.json", headers=HEADERS, timeout=20)
            r.raise_for_status()
        except requests.RequestException as e:
            log.warning("Open Library work lookup failed for %s: %s", row["ol_key"], e)
            continue  # retried next run
        d = r.json().get("description")
        row["description"] = plain_description(d.get("value") if isinstance(d, dict) else d)


def enrich(books: list[dict], cached: list[dict], extracted_at: str) -> list[dict]:
    by_id = {c["hardcover_id"]: c for c in cached}
    rows = []
    for b in books:
        if b["hardcover_id"] in by_id:
            rows.append(by_id[b["hardcover_id"]])
            continue
        try:
            doc = search_openlibrary(b["title"], (b.get("authors") or [None])[0])
        except requests.RequestException as e:
            log.warning("Open Library search failed for %s: %s", b["title"], e)
            continue  # retried next run
        if doc:
            rows.append(to_row(b["hardcover_id"], doc, extracted_at))
    return rows
