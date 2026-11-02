"""My books from Hardcover. Query and author rule copied from the main
project's dagster/ops/hardcover_op.py (copied, not imported). Only the
fields listed in parse_user_books leave this module, so no account data
reaches the public repo."""
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
        contributions {
          contribution
          author {
            name
          }
        }
        editions {
          isbn_10
          isbn_13
        }
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


def get_isbns(book: dict) -> tuple[Optional[str], Optional[str]]:
    editions = book.get("editions") or []
    isbn_13 = next((e["isbn_13"] for e in editions if e.get("isbn_13")), None)
    isbn_10 = next((e["isbn_10"] for e in editions if e.get("isbn_10")), None)
    return isbn_13, isbn_10


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


def parse_user_books(user_books: list[dict], extracted_at: str) -> list[dict]:
    rows = []
    for ub in user_books:
        book = ub.get("book") or {}
        isbn_13, isbn_10 = get_isbns(book)
        dates = sorted(r["finished_at"][:10] for r in ub.get("user_book_reads") or [] if r.get("finished_at"))
        rows.append({
            "hardcover_id": str(ub["id"]),
            "title": book.get("title") or "",
            "authors": get_authors(book),
            "isbn_13": isbn_13,
            "isbn_10": isbn_10,
            "rating": ub.get("rating"),
            "status_id": ub.get("status_id"),
            "finished_dates": dates,
            "extracted_at": extracted_at,
        })
    return rows
