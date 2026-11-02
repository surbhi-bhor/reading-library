import pytest
import responses

from extract.hardcover import HARDCOVER_URL, fetch_user_books, parse_user_books

TS = "2026-11-03T00:00:00+00:00"


def user_book(**overrides):
    ub = {
        "id": 7,
        "rating": 4.5,
        "status_id": 3,
        "user_book_reads": [],
        "book": {
            "title": "Some Book",
            "contributions": [{"contribution": None, "author": {"name": "A"}}],
            "editions": [{"isbn_10": None, "isbn_13": None}, {"isbn_10": "123", "isbn_13": "978"}],
        },
    }
    ub.update(overrides)
    return ub


def test_parse_prefers_author_over_translator():
    ub = user_book()
    ub["book"]["contributions"] = [
        {"contribution": "Translator", "author": {"name": "T"}},
        {"contribution": None, "author": {"name": "A"}},
    ]
    assert parse_user_books([ub], TS)[0]["authors"] == ["A"]


def test_parse_falls_back_to_first_contributor():
    ub = user_book()
    ub["book"]["contributions"] = [{"contribution": "Illustrator", "author": {"name": "I"}}]
    assert parse_user_books([ub], TS)[0]["authors"] == ["I"]


def test_parse_keeps_every_finish_date():
    ub = user_book(user_book_reads=[{"finished_at": "2025-03-01"}, {"finished_at": None}, {"finished_at": "2024-01-09"}])
    assert parse_user_books([ub], TS)[0]["finished_dates"] == ["2024-01-09", "2025-03-01"]


def test_parse_row_has_only_allowed_keys():
    row = parse_user_books([user_book()], TS)[0]
    assert set(row) == {"hardcover_id", "title", "authors", "isbn_13", "isbn_10", "rating", "status_id", "finished_dates", "extracted_at"}
    assert row["hardcover_id"] == "7" and row["isbn_13"] == "978" and row["rating"] == 4.5 and row["status_id"] == 3


@responses.activate
def test_fetch_raises_on_graphql_errors():
    responses.post(HARDCOVER_URL, json={"errors": [{"message": "x"}]})
    with pytest.raises(RuntimeError, match="GraphQL"):
        fetch_user_books("token")


@responses.activate
def test_fetch_returns_empty_list_when_me_missing():
    responses.post(HARDCOVER_URL, json={"data": {"me": []}})
    assert fetch_user_books("token") == []
