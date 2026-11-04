"""Articles I have read, from Raindrop.io. Every bookmark counts as read:
I save a piece from the Substack or Medium share button once I finish it.
Only the fields listed in parse_raindrops leave this module, so no
account data reaches the public repo."""
import json
import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests

API = "https://api.raindrop.io/rest/v1"
RAINDROPS_URL = f"{API}/raindrops"
ALL_BOOKMARKS = 0  # Raindrop's id for every collection except the trash
PER_PAGE = 50  # Raindrop's maximum
ARTICLE_TYPES = {"article", "link"}  # Raindrop files most web pages as one of these


def _get(url: str, token: str, **params) -> dict:
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def fetch_bookmarks(token: str) -> list[dict]:
    """Every bookmark in every collection, page by page; the trash is left out."""
    items, page = [], 0
    while True:
        batch = _get(f"{RAINDROPS_URL}/{ALL_BOOKMARKS}", token, perpage=PER_PAGE, page=page).get("items") or []
        items += batch
        if len(batch) < PER_PAGE:
            return items
        page += 1


def source_name(host: str) -> str:
    host = host.lower().removeprefix("www.")
    if host == "medium.com" or host.endswith(".medium.com"):
        return "Medium"
    if host.endswith(".substack.com") or host == "substack.com":
        return "Substack"
    return host  # custom domains (many Substacks have one) show as the site's address


def safe_cover(url: Optional[str]) -> Optional[str]:
    """The preview image Raindrop keeps (the one a share shows). It ends up in
    a CSS url() on the site, so only a plain https address with no quotes,
    brackets or spaces is kept."""
    url = (url or "").strip()
    if not url.startswith("https://") or any(c in url for c in "\"'()<> \\;"):
        return None
    return url


def parse_raindrops(items: list[dict], extracted_at: str) -> list[dict]:
    rows = []
    for it in items:
        link = it.get("link") or ""
        if it.get("type") not in ARTICLE_TYPES or not link.startswith("https://"):
            continue  # the site only links to https pages
        tags: list = it.get("tags") or []
        note: Optional[str] = (it.get("note") or "").strip() or None
        rows.append({
            "read_id": f"raindrop:{it['_id']}",
            "title": (it.get("title") or "").strip() or link,
            "author": None,  # Raindrop keeps no author field
            "source": source_name(it.get("domain") or urlparse(link).hostname or ""),
            "url": link,
            "topic": tags[0] if tags else None,
            "note": note,
            "added_on": (it.get("created") or "")[:10] or None,
            "status": "read",
            "extracted_at": extracted_at,
            "cover_url": safe_cover(it.get("cover")),
        })
    return sorted(rows, key=lambda r: r["read_id"])


def update_articles(path: Path, rows: list[dict]) -> int:
    """Write the articles file. An empty fetch never wipes saved articles
    (it is far likelier an API hiccup than every article deleted); on a
    first run it writes an empty list so dbt has a file to read."""
    path = Path(path)
    if not rows:
        if path.exists():
            return len(json.loads(path.read_text(encoding="utf-8")))
        rows = []
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    return len(rows)
