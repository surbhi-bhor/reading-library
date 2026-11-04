"""My books from Hardcover. Query and author rule copied from the main
project's dagster/ops/hardcover_op.py (copied, not imported). Only the
fields listed in parse_user_books leave this module, so no account data
reaches the public repo."""
import html
import re
from typing import Optional

import requests

HARDCOVER_URL = "https://api.hardcover.app/v1/graphql"

HARDCOVER_QUERY = """
{
  me {
    user_books {
      id
      rating
      status_id
      user_book_reads {
        finished_at
      }
      book {
        title
        description
        image {
          url
          width
          height
        }
        contributions {
          contribution
          author {
            name
          }
        }
        editions {
          title
          isbn_10
          isbn_13
          reading_format {
            format
          }
          language {
            code2
          }
          image {
            url
            width
            height
          }
        }
        cached_tags
      }
    }
  }
}
"""


def fetch_user_books(token: str) -> list[dict]:
    r = requests.post(
        HARDCOVER_URL,
        headers={"Authorization": token, "Content-Type": "application/json"},
        json={"query": HARDCOVER_QUERY},
        timeout=20,
    )
    r.raise_for_status()
    data = r.json()
    # Schema problems come back as HTTP 200 with "errors" and no "data".
    if data.get("errors"):
        raise RuntimeError(f"GraphQL error from Hardcover: {data['errors']}")
    me = (data.get("data") or {}).get("me") or [{}]
    return me[0].get("user_books") or []


def best_cover(book: dict) -> tuple[Optional[str], Optional[int]]:
    """The sharpest cover: the book's own image, or a taller one from an
    English print or ebook edition. Only portrait images count, because
    some editions carry a photo of the book or a square crop instead. An
    edition with no language counts only under the book's own title, since
    unlabelled translations exist ("La Psy" for Never Lie). Audiobook
    editions never count: their art says "Audiobook"."""
    def portrait(img):
        w, h = img.get("width") or 0, img.get("height") or 0
        return bool(img.get("url")) and w > 0 and 1.25 <= h / w <= 1.75

    def name(t):
        return re.sub(r"\W+", " ", (t or "").split(":")[0]).strip().lower()

    def english(e):
        code = (e.get("language") or {}).get("code2")
        return code == "en" or (code is None and name(e.get("title")) == name(book.get("title")))

    def printed(e):
        return (e.get("reading_format") or {}).get("format") != "Listened"

    own = book.get("image") or {}
    picks = [own] if own.get("url") else []
    picks += [e["image"] for e in book.get("editions") or []
              if e.get("image") and english(e) and printed(e) and portrait(e["image"])]
    if not picks:
        return None, None
    best = max(picks, key=lambda i: i.get("height") or 0)
    return best["url"], best.get("height")


def get_isbns(book: dict) -> tuple[Optional[str], Optional[str]]:
    """ISBNs of an English edition, so a Goodreads link opens the book in
    English. Editions with no language count as English only when no edition
    says it is; with no English edition at all, no ISBN (the site then links a
    title search instead of a translation)."""
    editions = book.get("editions") or []
    english = [e for e in editions if ((e.get("language") or {}).get("code2") == "en")]
    if not english and not any(e.get("language") for e in editions):
        english = editions
    isbn_13 = next((e["isbn_13"] for e in english if e.get("isbn_13")), None)
    isbn_10 = next((e["isbn_10"] for e in english if e.get("isbn_10")), None)
    return isbn_13, isbn_10


def clean_description(text: Optional[str], limit: int = 700) -> Optional[str]:
    """Hardcover descriptions arrive as HTML: keep the words, drop the markup,
    and cut at a sentence end near `limit` characters."""
    if not text:
        return None
    plain = html.unescape(re.sub(r"<[^>]+>", " ", text))
    # Markdown quote and list markers ("> -How to...") show up as stray symbols.
    plain = re.sub(r"(?:^|\s)>(?=\s|-|$)", " ", plain)
    plain = re.sub(r"(?:^|(?<=\s))[-*•](?=\S)", "", plain)
    plain = re.sub(r"\s+", " ", plain).strip()
    # Tags become spaces, which strands punctuation: "Shetty , social".
    plain = re.sub(r" ([,.;:!?)])", r"\1", plain)
    if len(plain) <= limit:
        return plain or None
    cut = plain[:limit]
    # A sentence end, but not the dot after a title such as "Mr." or "Dr.".
    ends = [m.start() for m in re.finditer(r"[.!?](?= )", cut)
            if not re.search(r"\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|vs)$", cut[: m.start()])]
    end = ends[-1] if ends else -1
    return (cut[: end + 1] if end > limit // 2 else cut.rstrip() + "…")


def get_authors(book: dict) -> list[str]:
    """Contributors credited as author, in order. contributions also lists
    translators, illustrators and narrators, sometimes first. Hardcover
    leaves the role empty on some author credits, so empty counts as author."""
    contributions = book.get("contributions") or []
    authors = [
        c["author"]["name"]
        for c in contributions
        if (c.get("contribution") or "Author") == "Author" and (c.get("author") or {}).get("name")
    ]
    if not authors and contributions and (contributions[0].get("author") or {}).get("name"):
        authors = [contributions[0]["author"]["name"]]
    return authors


# Want to read, currently reading, read. Did-not-finish (5) and any other
# status never appear on the site, so they never enter the public raw file.
SHOWN_STATUSES = {1, 2, 3}


def parse_user_books(user_books: list[dict], extracted_at: str) -> list[dict]:
    rows = []
    for ub in user_books:
        if ub.get("status_id") not in SHOWN_STATUSES:
            continue
        book = ub.get("book") or {}
        isbn_13, isbn_10 = get_isbns(book)
        cover_url, cover_height = best_cover(book)
        dates = sorted(r["finished_at"][:10] for r in ub.get("user_book_reads") or [] if r.get("finished_at"))
        rows.append({
            "hardcover_id": str(ub["id"]),
            "title": book.get("title") or "",
            "authors": get_authors(book),
            "isbn_13": isbn_13,
            "isbn_10": isbn_10,
            "description": clean_description(book.get("description")),
            "cover_url": cover_url,
            "cover_height": cover_height,
            "rating": ub.get("rating"),
            "status_id": ub.get("status_id"),
            "finished_dates": dates,
            # Crowd-sourced genre tags, most used first. Content warnings are
            # not needed and stay out of the repo.
            "genres": [g["tag"].strip() for g in ((book.get("cached_tags") or {}).get("Genre") or []) if (g.get("tag") or "").strip()][:8],
            # Readers' mood tags, most used first, for the mood breakdown on Stats.
            "moods": list(dict.fromkeys(m["tag"].strip().lower() for m in ((book.get("cached_tags") or {}).get("Mood") or []) if (m.get("tag") or "").strip()))[:6],
            "extracted_at": extracted_at,
        })
    return rows
