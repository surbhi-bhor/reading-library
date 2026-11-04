import pytest
import responses

from extract.hardcover import HARDCOVER_URL, best_cover, fetch_user_books, parse_user_books

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
            "cached_tags": {"Genre": [{"tag": "Thriller", "count": 4}, {"tag": "Mystery", "count": 3}], "Mood": [{"tag": "dark"}]},
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
    assert set(row) == {"hardcover_id", "title", "authors", "isbn_13", "isbn_10", "description", "cover_url", "cover_height", "rating", "status_id", "finished_dates", "genres", "moods", "extracted_at"}
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


def test_parse_drops_books_the_site_never_shows():
    # Did-not-finish (5) and unknown statuses must not reach the public raw file.
    rows = parse_user_books([user_book(id=1, status_id=5), user_book(id=2, status_id=4), user_book(id=3, status_id=1)], TS)
    assert [r["hardcover_id"] for r in rows] == ["3"]


def test_parse_keeps_hardcover_genre_tags_only():
    assert parse_user_books([user_book()], TS)[0]["genres"] == ["Thriller", "Mystery"]


def test_parse_handles_books_without_tags():
    ub = user_book()
    ub["book"]["cached_tags"] = None
    assert parse_user_books([ub], TS)[0]["genres"] == []


def test_isbn_prefers_an_english_edition():
    from extract.hardcover import get_isbns
    book = {"editions": [
        {"isbn_13": "9789523640788", "isbn_10": None, "language": {"code2": "fi"}},
        {"isbn_13": "9781786892737", "isbn_10": None, "language": {"code2": "en"}},
    ]}
    assert get_isbns(book)[0] == "9781786892737"
    # Only translations: no ISBN, so the site falls back to a title search.
    assert get_isbns({"editions": [{"isbn_13": "978842", "language": {"code2": "es"}}]}) == (None, None)
    # No languages recorded at all: take what there is.
    assert get_isbns({"editions": [{"isbn_13": "978111", "isbn_10": "111"}]}) == ("978111", "111")


def test_description_loses_its_markup_and_stops_at_a_sentence():
    from extract.hardcover import clean_description
    assert clean_description("<p>A <b>quiet</b> book &amp; a cat.</p>") == "A quiet book & a cat."
    long = "One sentence here. " * 60
    out = clean_description(long, limit=100)
    assert len(out) <= 100 and out.endswith(".")
    assert clean_description(None) is None
    # "Mr." is not a sentence end, so the cut falls after the full sentence.
    titled = "She sat in the quiet old shop. Later she met Mr. Fakhri and many others there."
    assert clean_description(titled, limit=55) == "She sat in the quiet old shop."


def img(url, w, h):
    return {"url": url, "width": w, "height": h}


def test_best_cover_takes_the_tallest_portrait_english_cover():
    book = {"image": img("own", 98, 150), "editions": [
        {"language": {"code2": "en"}, "image": img("tall", 980, 1500)},
        {"language": {"code2": "en"}, "image": img("photo", 4624, 3468)},   # a photo of the book, landscape
        {"language": {"code2": "en"}, "image": img("square", 3000, 3000)},  # a square crop, not a cover
        {"language": {"code2": "fr"}, "image": img("french", 1300, 2000)},  # a translation's cover
        {"language": None, "image": None},
    ]}
    assert best_cover(book) == ("tall", 1500)
    # An unlabelled edition counts only under the book's title; audiobooks never.
    never_lie = {"title": "Never Lie", "image": img("own", 313, 500), "editions": [
        {"language": None, "title": "La Psy", "image": img("french", 970, 1500)},
        {"language": {"code2": "en"}, "title": "Never Lie", "reading_format": {"format": "Listened"}, "image": img("audio", 400, 600)},
        {"language": None, "title": "Never Lie: A Novel", "image": img("untagged", 330, 520)},
    ]}
    assert best_cover(never_lie) == ("untagged", 520)
    # Without a better edition, the book's own image stays.
    assert best_cover({"image": img("own", 326, 500), "editions": []}) == ("own", 500)
    assert best_cover({}) == (None, None)


def test_description_drops_stray_spaces_and_markdown_markers():
    from extract.hardcover import clean_description
    assert clean_description("<p>By <b>Jay Shetty</b>, social star.</p>") == "By Jay Shetty, social star."
    assert clean_description("You learn: > -How to rest > -How to think") == "You learn: How to rest How to think"
    assert clean_description("A self-help book - mostly") == "A self-help book - mostly"


def test_parse_keeps_moods_in_lower_case_without_repeats():
    ub = user_book()
    ub["book"]["cached_tags"]["Mood"] = [{"tag": "Dark"}, {"tag": "dark "}, {"tag": "reflective"}, {"tag": ""}]
    assert parse_user_books([ub], TS)[0]["moods"] == ["dark", "reflective"]
