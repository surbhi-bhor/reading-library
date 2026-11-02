import responses

from extract import openlibrary
from extract.openlibrary import SEARCH_URL, enrich

TS = "2026-11-03T00:00:00+00:00"


def book(hid, title="Some Book", authors=("Elif Shafak",)):
    return {"hardcover_id": hid, "title": title, "authors": list(authors)}


def doc(**overrides):
    d = {"key": "/works/OL1W", "author_name": ["Elif Şafak"], "first_publish_year": 2019,
         "number_of_pages_median": 320, "subject": ["Istanbul", "Fiction"], "cover_i": 99, "publisher": ["Viking"]}
    d.update(overrides)
    return d


def setup_function():
    openlibrary.PAUSE_SECONDS = 0


@responses.activate
def test_enrich_matches_transliterated_author():
    responses.get(SEARCH_URL, json={"docs": [doc()]})
    rows = enrich([book("1")], [], TS)
    assert rows == [{"hardcover_id": "1", "ol_key": "/works/OL1W", "author_name": "Elif Şafak", "first_publish_year": 2019,
                     "page_count": 320, "subjects": ["Istanbul", "Fiction"], "cover_id": 99, "publisher": "Viking", "extracted_at": TS}]


@responses.activate
def test_enrich_skips_cached_books():
    cached = [{"hardcover_id": "1", "ol_key": "/works/OLX"}]
    assert enrich([book("1")], cached, TS) == cached
    assert len(responses.calls) == 0


@responses.activate
def test_enrich_keeps_going_on_http_error():
    responses.get(SEARCH_URL, status=500)
    responses.get(SEARCH_URL, json={"docs": [doc()]})
    rows = enrich([book("1"), book("2")], [], TS)
    assert [r["hardcover_id"] for r in rows] == ["2"]


@responses.activate
def test_enrich_prefers_latin_author_name():
    responses.get(SEARCH_URL, json={"docs": [doc(author_name=["村上春樹"], author_alternative_name=["Haruki Murakami"])]})
    rows = enrich([book("1", authors=["Haruki Murakami"])], [], TS)
    assert rows[0]["author_name"] == "Haruki Murakami"


@responses.activate
def test_enrich_skips_unmatched_book():
    responses.get(SEARCH_URL, json={"docs": [doc(author_name=["Someone Else"])]})
    assert enrich([book("1")], [], TS) == []
