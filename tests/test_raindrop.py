import json

import responses

from extract.raindrop import RAINDROPS_URL, fetch_bookmarks, parse_raindrops, update_articles

TS = "2026-11-04T00:00:00+00:00"


def drop(i, **overrides):
    d = {"_id": i, "title": f"Essay {i}", "link": f"https://writer.substack.com/p/essay-{i}", "type": "article",
         "domain": "writer.substack.com", "tags": ["Money", "habits"], "note": "Why it stayed with me.",
         "excerpt": "First lines.", "created": "2026-10-30T08:15:00.000Z", "cover": "https://substackcdn.com/image/fetch/essay.jpg", "user": {"$id": 1}, "creatorRef": {"name": "me"}}
    d.update(overrides)
    return d


def test_parse_keeps_only_site_fields_and_names_the_source():
    rows = parse_raindrops([drop(1), drop(2, link="https://medium.com/@a/b", domain="medium.com", tags=[], note="")], TS)
    assert rows[0] == {"read_id": "raindrop:1", "title": "Essay 1", "author": None, "source": "Substack",
                       "url": "https://writer.substack.com/p/essay-1", "topic": "Money", "note": "Why it stayed with me.",
                       "added_on": "2026-10-30", "status": "read", "extracted_at": TS,
                       "cover_url": "https://substackcdn.com/image/fetch/essay.jpg"}
    assert rows[1]["source"] == "Medium" and rows[1]["topic"] is None and rows[1]["note"] is None


def test_parse_skips_non_articles_and_unsafe_links():
    rows = parse_raindrops([drop(1, type="image"), drop(2, link="http://plain.example/x"), drop(3, link="javascript:alert(1)"),
                            drop(4, link="https://www.example.org/post", domain="www.example.org")], TS)
    assert [(r["read_id"], r["source"]) for r in rows] == [("raindrop:4", "example.org")]


def test_parse_keeps_only_https_covers():
    # The cover lands in a CSS url() on the site, so only a plain https address passes.
    rows = parse_raindrops([drop(1, cover=""), drop(2, cover="http://x.example/a.jpg"),
                            drop(3, cover='https://x.example/a.jpg") ; background: red'), drop(4, cover=None)], TS)
    assert [r["cover_url"] for r in rows] == [None, None, None, None]


@responses.activate
def test_fetch_reads_every_bookmark_outside_the_trash_page_by_page():
    responses.get(f"{RAINDROPS_URL}/0", json={"items": [drop(i) for i in range(50)]})
    responses.get(f"{RAINDROPS_URL}/0", json={"items": [drop(50)]})
    items = fetch_bookmarks("tok")
    assert len(items) == 51
    assert responses.calls[0].request.headers["Authorization"] == "Bearer tok"
    assert "page=0" in responses.calls[0].request.url and "page=1" in responses.calls[1].request.url


def test_update_never_replaces_saved_articles_with_nothing(tmp_path):
    path = tmp_path / "raindrop_articles.json"
    path.write_text(json.dumps([{"read_id": "raindrop:1"}]), encoding="utf-8")
    assert update_articles(path, []) == 1  # kept yesterday's file
    assert json.loads(path.read_text(encoding="utf-8")) == [{"read_id": "raindrop:1"}]
    fresh = tmp_path / "new.json"
    assert update_articles(fresh, []) == 0  # a first run with nothing saved yet writes an empty list
    assert json.loads(fresh.read_text(encoding="utf-8")) == []
