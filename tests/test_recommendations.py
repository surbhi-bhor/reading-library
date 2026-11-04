import json

import responses

from extract.recommendations import fetch_all, parse_recommendations, update_recommendations

TS = "2026-11-04T00:00:00+00:00"
URL = "https://abc.supabase.co"
OL = "https://openlibrary.org"


def rec(i, **overrides):
    d = {"id": f"00000000-0000-0000-0000-00000000000{i}", "created_at": "2026-11-03T09:30:00+00:00",
         "title": "typed by the visitor", "author": "typed too", "ol_key": f"/works/OL{i}W", "cover_id": 999,
         "recommended_by": "  Asha  ", "note": "You will love the ending.", "approved": False}
    d.update(overrides)
    return d


def ol_work(i, title="Circe", cover=8739376):
    responses.get(f"{OL}/works/OL{i}W.json", json={"title": title, "covers": [cover], "authors": [{"author": {"key": f"/authors/OL{i}A"}}]})
    responses.get(f"{OL}/authors/OL{i}A.json", json={"name": "Madeline Miller"})


@responses.activate
def test_a_real_open_library_book_goes_on_the_shelf_with_the_visitors_name_and_note():
    ol_work(1)
    rows = parse_recommendations([rec(1)], [], TS)
    assert rows == [{"rec_id": "00000000-0000-0000-0000-000000000001", "title": "Circe", "author": "Madeline Miller",
                     "ol_key": "/works/OL1W", "cover_id": 8739376, "recommended_by": "Asha", "note": "You will love the ending.",
                     "recommended_on": "2026-11-03", "extracted_at": TS}]


@responses.activate
def test_words_with_links_are_dropped_but_the_book_stays():
    ol_work(1)
    row = parse_recommendations([rec(1, recommended_by="cheap pills www.spam.example", note="buy at https://x.example")], [], TS)[0]
    assert (row["title"], row["recommended_by"], row["note"]) == ("Circe", None, None)


@responses.activate
def test_only_books_that_check_out_on_open_library_show():
    responses.get(f"{OL}/works/OL2W.json", status=404)
    rows = parse_recommendations([rec(2), rec(3, ol_key="javascript:alert(1)"), rec(4, ol_key=None, approved=True)], [], TS)
    assert rows == []


@responses.activate
def test_books_checked_before_are_not_looked_up_again():
    saved = [{"rec_id": "00000000-0000-0000-0000-000000000001", "title": "Circe", "author": "Madeline Miller",
              "ol_key": "/works/OL1W", "cover_id": 8739376}]
    rows = parse_recommendations([rec(1)], saved, TS)
    assert len(responses.calls) == 0 and rows[0]["title"] == "Circe"


@responses.activate
def test_fetch_reads_every_row_with_the_service_key():
    responses.get(f"{URL}/rest/v1/recommendations", json=[rec(1)])
    assert fetch_all(URL, "secret") == [rec(1)]
    req = responses.calls[0].request
    assert req.headers["apikey"] == "secret" and req.headers["Authorization"] == "Bearer secret"
    assert "approved" not in req.url


def test_update_writes_exactly_what_is_current_even_nothing(tmp_path):
    # Unlike books, an empty answer here is real: deleting the last row must remove it.
    path = tmp_path / "recommendations.json"
    path.write_text(json.dumps([{"rec_id": "a"}]), encoding="utf-8")
    assert update_recommendations(path, []) == 0
    assert json.loads(path.read_text(encoding="utf-8")) == []
    assert update_recommendations(path, [{"rec_id": "b"}]) == 1
    assert json.loads(path.read_text(encoding="utf-8")) == [{"rec_id": "b"}]
