import json

import pytest

from extract.raw_store import EmptyExtractError, write_raw


def test_write_raw_writes_rows(tmp_path):
    p = tmp_path / "x.json"
    assert write_raw(p, [{"a": 1}]) == 1
    assert json.loads(p.read_text()) == [{"a": 1}]


def test_write_raw_refuses_empty_and_keeps_old_file(tmp_path):
    p = tmp_path / "x.json"
    p.write_text('[{"old": true}]')
    with pytest.raises(EmptyExtractError):
        write_raw(p, [])
    assert json.loads(p.read_text()) == [{"old": True}]


def test_write_raw_sorts_by_hardcover_id(tmp_path):
    p = tmp_path / "x.json"
    write_raw(p, [{"hardcover_id": "2"}, {"hardcover_id": "1"}])
    assert [r["hardcover_id"] for r in json.loads(p.read_text())] == ["1", "2"]
