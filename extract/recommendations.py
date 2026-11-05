"""Books visitors recommend to me, from the Supabase table the site writes to
(supabase/recommendations.sql). No manual approval: a book goes on the shelf
once it checks out as a real Open Library work, with Open Library's own
title, author and cover, never the text the visitor sent. The visitor's name
and note show too, unless they contain a web link (what spam bots post).
Only the fields in parse_recommendations leave this module."""
import re
from pathlib import Path
from typing import Optional

import requests

from extract.openlibrary import HEADERS
from extract.raw_store import write_raw

OL_KEY = re.compile(r"^/works/OL\d+W$")
LINK = re.compile(r"https?://|www\.|\.(com|net|org|io|ru|xyz)\b", re.I)
OL = "https://openlibrary.org"


def fetch_all(url: str, service_key: str) -> list[dict]:
    r = requests.get(
        f"{url.rstrip('/')}/rest/v1/recommendations",
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        params={"select": "*", "order": "created_at.asc"},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def _text(value, limit: int) -> Optional[str]:
    value = " ".join(str(value or "").split())
    return value[:limit] or None


def verify_work(ol_key: str) -> Optional[dict]:
    """Open Library's own title, first author and cover for a work, or None
    if the work does not exist (or Open Library cannot say right now)."""
    try:
        r = requests.get(f"{OL}{ol_key}.json", headers=HEADERS, timeout=20)
        if r.status_code != 200:
            return None
        work = r.json()
        author = None
        key = ((work.get("authors") or [{}])[0].get("author") or {}).get("key")
        if key and re.match(r"^/authors/OL\d+A$", key):
            a = requests.get(f"{OL}{key}.json", headers=HEADERS, timeout=20)
            author = a.json().get("name") if a.status_code == 200 else None
    except (requests.RequestException, ValueError):
        return None
    covers = [c for c in work.get("covers") or [] if isinstance(c, int) and c > 0]
    title = _text(work.get("title"), 300)
    return {"title": title, "author": _text(author, 200), "cover_id": covers[0] if covers else None} if title else None


def parse_recommendations(items: list[dict], saved: list[dict], extracted_at: str) -> list[dict]:
    """`saved` is last night's file: books already checked are not looked up again."""
    checked = {s["rec_id"]: s for s in saved if s.get("ol_key")}
    words = lambda v, n: None if LINK.search(str(v or "")) else _text(v, n)  # noqa: E731
    rows = []
    for it in items:
        rec_id = str(it["id"])
        ol_key = it.get("ol_key") if OL_KEY.match(str(it.get("ol_key") or "")) else None
        if not ol_key:
            continue  # only real Open Library books reach the shelf
        known = checked.get(rec_id)
        book = ({k: known[k] for k in ("title", "author", "cover_id")} if known and known["ol_key"] == ol_key
                else verify_work(ol_key))
        if not book:
            continue  # not a real work (or Open Library is down): try again next run
        rows.append({
            "rec_id": rec_id,
            **book,
            "ol_key": ol_key,
            "recommended_by": words(it.get("recommended_by"), 60),
            "note": words(it.get("note"), 500),
            "recommended_on": (it.get("created_at") or "")[:10] or None,
            "extracted_at": extracted_at,
        })
    return sorted(rows, key=lambda r: r["rec_id"])


def update_recommendations(path: Path, rows: list[dict]) -> int:
    """Write exactly the current rows, even none: deleting a row in Supabase
    must take it off the site. A failed fetch never reaches here (the caller
    keeps yesterday's file), so empty means really empty."""
    if rows:
        return write_raw(path, rows)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("[]\n", encoding="utf-8")
    return 0
