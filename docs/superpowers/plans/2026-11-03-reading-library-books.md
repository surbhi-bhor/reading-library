# Reading Library (books) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, nightly-refreshed static library site of my books, backed by a DuckDB warehouse modelled in dbt with one definition per metric.

**Architecture:** Python extractors write raw JSON files (committed to the repo, never overwritten with an empty response). dbt-duckdb reads those files as sources, builds staging, a star schema, metric models and a small `publish` layer. An Observable Framework site reads only the `publish` and `metrics` tables through Python data loaders at build time. One GitHub Actions workflow runs it nightly and deploys to GitHub Pages; a failing dbt test stops the deploy.

**Tech Stack:** Python 3.12 (requests, duckdb), dbt-core 1.9 + dbt-duckdb 1.9, Observable Framework 1.x (Node 20), pytest, ruff, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-03-reading-library-design.md`

**Scope:** Build order steps 1 to 5 and the book parts of step 7. Articles (step 6) get their own plan once the logging tool is chosen. Long-form share is computed but not shown until articles exist.

## Global Constraints

- Free only: public GitHub repo, GitHub Actions, GitHub Pages. No paid APIs or services.
- Secrets (Hardcover token) live only in GitHub Actions secrets and a local, git-ignored `.env`. Never in raw files, the warehouse, or the built site.
- Every view must look right with about 30 books, roughly half without a finish date.
- English display text: author names in Latin script or blank; non-English Open Library subjects dropped.
- Never delete history on an empty response: an extractor that gets zero rows fails loudly and leaves the previous raw file untouched.
- One definition per number: every number on the site comes from a `metrics` model, never page-level SQL.
- Ratings stored 0 to 10 (Hardcover's 0 to 5 times 2), nullable.
- Reading minutes for books: `page_count * 1.5` (dbt var `minutes_per_page: 1.5`).
- Pinned versions: `requirements.txt` and `package-lock.json` committed with exact versions.
- Copy rules for all writing (UI text, docs, commits): no em dashes, no AI-sounding phrasing, no AI attribution trailers in commits.
- Commit only when the user asks; never push or create the GitHub repo without asking.
- Look: warm, classic library. Display font `IM Fell English` (italic for the welcome line), body `EB Garamond`, small letter-spaced labels `IBM Plex Mono`. Tokens: `--parchment #F3EBDD`, `--paper #FAF5EA`, `--ink #2B2118`, `--walnut #5B3A24`, `--walnut-dark #3E2716`, `--brass #B08D57`, `--muted #7A6A58`.

## Review Focus

1. A book Open Library cannot match (no cover, no page count, no subjects): it must still get a spine with a fallback colour and default width, appear on the shelf and count in "items read". Pinned in Task 9 (`spineStyle` fallback test) and Task 6 (unit test: unmatched book still in `dim_item` and `fact_reading`).
2. A re-read book (two finish dates): two rows in `fact_reading`, one spine on the shelf. Pinned in Task 6 (dbt unit test).
3. A book moved back to want-to-read, or marked did-not-finish, that still has a rating or an old finish date: never in a metric; DNF never shown. Pinned in Task 6 (dbt unit test).
4. Hardcover answers HTTP 200 with `errors`, or an empty library: run fails, raw file unchanged. Pinned in Task 2 and Task 1 tests.
5. Long titles and missing authors on a narrow spine and on a phone: spine label truncates with an ellipsis, author line hidden when null, shelf scrolls sideways at 375px. Pinned in Task 9 (`spineLabel` test) and the manual phone check in Task 10.

---

## File Structure

```text
.gitignore, .env.example, requirements.txt, requirements-dev.txt, ruff.toml, pytest.ini, README.md
extract/
  __init__.py
  raw_store.py        write_raw(): atomic JSON write, refuses empty
  hardcover.py        fetch + parse Hardcover user_books
  openlibrary.py      match + enrich, cached per hardcover_id
  english.py          normalize_name, author_matches, is_latin_script, english_author_name (copied)
  __main__.py         python -m extract
data/raw/
  hardcover_books.json
  openlibrary_books.json
tests/
  test_raw_store.py, test_hardcover.py, test_openlibrary.py
dbt/
  dbt_project.yml, profiles.yml
  macros/english_text.sql
  models/sources.yml
  models/staging/  stg_hardcover__books.sql, stg_hardcover__reads.sql,
                   stg_openlibrary__books.sql, stg_openlibrary__subjects.sql, staging.yml
  models/marts/    dim_item.sql, dim_creator.sql, bridge_item_creator.sql, dim_source.sql,
                   dim_topic.sql, bridge_item_topic.sql, dim_date.sql, fact_reading.sql, marts.yml
  models/metrics/  metric_items_read.sql, metric_books_by_period.sql, metric_pages_read.sql,
                   metric_reading_time.sql, metric_avg_rating.sql, metric_top_creators.sql,
                   metric_topic_mix.sql, metric_long_form_share.sql, metric_undated_reads.sql, metrics.yml
  models/publish/  pub_shelf.sql, pub_build_info.sql, publish.yml
  seeds/allowed_published_columns.csv
  tests/assert_published_columns_allowed.sql, assert_metrics_agree.sql
site/
  package.json, package-lock.json, observablehq.config.js
  src/style.css
  src/data/shelf.json.py, metrics.json.py, build.json.py, _warehouse.py
  src/components/spine.js, shelf.js, bookPanel.js, catalogue.js
  src/index.md, shelves.md, catalogue.md, year.md, about.md
  test/spine.test.js
scripts/copy_dbt_docs.py
.github/workflows/ci.yml, nightly.yml
docs/case-study.md
```

---

### Task 1: Repo skeleton and safe raw writer

**Files:**
- Create: `.gitignore`, `.env.example`, `requirements.txt`, `requirements-dev.txt`, `ruff.toml`, `pytest.ini`, `extract/__init__.py`, `extract/raw_store.py`
- Test: `tests/test_raw_store.py`

**Interfaces:**
- Produces: `write_raw(path: Path, rows: list[dict]) -> int` (returns rows written; raises `EmptyExtractError` on empty `rows` without touching `path`). `class EmptyExtractError(RuntimeError)`.

- [ ] **Step 1: Init the repo.** `git init -b main`. `.gitignore`: `.env`, `*.duckdb`, `*.duckdb.wal`, `dbt/target/`, `dbt/logs/`, `site/node_modules/`, `site/dist/`, `site/src/.observablehq/cache/`, `__pycache__/`, `.venv/`, `bash.exe.stackdump`. `.env.example`: `HARDCOVER_API_TOKEN=get_free_key_at_hardcover.app`. `ruff.toml` copied from the main project (`select = ["E", "F"]`, `ignore = ["E501"]`, `target-version = "py312"`). `requirements.txt`: requests, duckdb, dbt-core 1.9.x, dbt-duckdb 1.9.x, python-dotenv. `requirements-dev.txt`: `-r requirements.txt`, pytest, responses, ruff. Create a venv, install, then rewrite both files with the exact installed versions (`pip freeze` filtered to these packages).

- [ ] **Step 2: Write the failing tests** in `tests/test_raw_store.py`:

```python
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
```

- [ ] **Step 3: Run** `pytest tests/test_raw_store.py -v`. Expected: FAIL (import error).
- [ ] **Step 4: Implement `write_raw`.** Write to `path.with_suffix(".tmp")` with `indent=2, sort_keys=True, ensure_ascii=False`, then `os.replace` (atomic, so a crash never leaves half a file). Rows sorted by `hardcover_id` when present so nightly diffs stay small.
- [ ] **Step 5: Run** `pytest -v && ruff check .`. Expected: PASS, no lint errors.
- [ ] **Step 6: Commit** (ask first): `chore: repo skeleton and safe raw writer`.

---

### Task 2: Hardcover extractor

**Files:**
- Create: `extract/hardcover.py`
- Test: `tests/test_hardcover.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HARDCOVER_QUERY: str`: the main project's query (`dagster/ops/hardcover_op.py`) plus `id` already there; no other fields.
  - `fetch_user_books(token: str) -> list[dict]`: POST to `https://api.hardcover.app/v1/graphql`, `timeout=20`; raises `RuntimeError` on GraphQL `errors`; returns `data.me[0].user_books` (empty list if absent).
  - `parse_user_books(user_books: list[dict], extracted_at: str) -> list[dict]`. Each row: `hardcover_id: str`, `title: str`, `authors: list[str]` (Author-role contributors in order; empty role counts as Author; fallback to first contributor), `isbn_13`, `isbn_10` (first non-null over editions), `rating: float | None` (0 to 5, as given), `status_id: int`, `finished_dates: list[str]` (ISO dates, sorted, nulls dropped), `extracted_at: str`. Nothing else, so no account data reaches the repo.

- [ ] **Step 1: Write the failing tests:**
  - `test_parse_prefers_author_over_translator`: contributions `[{"contribution":"Translator","author":{"name":"T"}}, {"contribution":null,"author":{"name":"A"}}]` gives `authors == ["A"]`.
  - `test_parse_keeps_every_finish_date`: reads `[{"finished_at":"2025-03-01"},{"finished_at":null},{"finished_at":"2024-01-09"}]` gives `finished_dates == ["2024-01-09","2025-03-01"]`.
  - `test_parse_row_has_only_allowed_keys`: `set(row) == {"hardcover_id","title","authors","isbn_13","isbn_10","rating","status_id","finished_dates","extracted_at"}`.
  - `test_fetch_raises_on_graphql_errors` (use `responses`): HTTP 200 body `{"errors":[{"message":"x"}]}` raises `RuntimeError` matching `"GraphQL"`.
  - `test_fetch_returns_empty_list_when_me_missing`: body `{"data":{"me":[]}}` gives `[]` (the CLI turns this into a failure via `write_raw`).
- [ ] **Step 2: Run** `pytest tests/test_hardcover.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `fetch_user_books` and `parse_user_books` in `extract/hardcover.py`, copying `get_isbns` and the author rule from the main project (copy, do not import). Header `Authorization: <token>` exactly as the main project sends it.
- [ ] **Step 4: Run** `pytest tests/test_hardcover.py -v`. Expected: PASS.
- [ ] **Step 5: Commit** (ask first): `feat: Hardcover extractor`.

---

### Task 3: Open Library enrichment

**Files:**
- Create: `extract/english.py`, `extract/openlibrary.py`
- Test: `tests/test_openlibrary.py`

**Interfaces:**
- Consumes: rows from `parse_user_books`.
- Produces:
  - `extract/english.py`: `normalize_name`, `author_matches`, `is_latin_script`, `english_author_name`, copied from `../Personal Content Intelligence Pipeline/dagster/ops/openlib_op.py` with their docstrings.
  - `search_openlibrary(title: str, author: str | None) -> dict | None`: copied logic (title search, then `q=title author`), fields extended with `publisher,author_alternative_name`.
  - `enrich(books: list[dict], cached: list[dict], extracted_at: str) -> list[dict]`. Output row per matched book: `hardcover_id`, `ol_key`, `author_name: str | None` (via `english_author_name`), `first_publish_year: int | None`, `page_count: int | None` (`number_of_pages_median`), `subjects: list[str]`, `cover_id: int | None` (`cover_i`), `publisher: str | None` (first), `extracted_at`. A book already in `cached` is not searched again and its cached row is kept. A request error for one book logs a warning and keeps going (no row for it, retried next night). Books with no match get no row.

- [ ] **Step 1: Write the failing tests** (mock `requests` with `responses`):
  - `test_enrich_matches_transliterated_author`: doc with `author_name ["Elif Şafak"]` matches Hardcover author `"Elif Shafak"`.
  - `test_enrich_skips_cached_books`: a book whose `hardcover_id` is in `cached` makes zero HTTP calls and its cached row is returned unchanged.
  - `test_enrich_keeps_going_on_http_error`: first book 500, second book 200; result has only the second book's row, no exception.
  - `test_enrich_prefers_latin_author_name`: `author_name ["村上春樹"]`, `author_alternative_name ["Haruki Murakami"]` gives `author_name == "Haruki Murakami"`.
- [ ] **Step 2: Run** `pytest tests/test_openlibrary.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** in `extract/openlibrary.py`. Sleep 0.5 s between requests (Open Library courtesy). `User-Agent: reading-library (github repo url)` header.
- [ ] **Step 4: Run** `pytest -v`. Expected: PASS.
- [ ] **Step 5: Commit** (ask first): `feat: Open Library enrichment with per-book cache`.

---

### Task 4: Extract CLI and first real extract

**Files:**
- Create: `extract/__main__.py`, `data/raw/hardcover_books.json`, `data/raw/openlibrary_books.json`

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces: `python -m extract` writes both raw files under `data/raw/`; exit code non-zero on `EmptyExtractError` or GraphQL error. Raw files are the dbt sources in Task 5.

- [ ] **Step 1: Implement `main() -> int`.** Load `.env` with python-dotenv; read `HARDCOVER_API_TOKEN` (exit 2 with a clear message if missing); `extracted_at = datetime.now(timezone.utc).isoformat()`; fetch, parse, `write_raw(data/raw/hardcover_books.json)`; load the existing `openlibrary_books.json` as cache if present, keep only cached rows whose `hardcover_id` is still in Hardcover, enrich, `write_raw`. Print counts: books, matched, newly matched.
- [ ] **Step 2: Run against the real API.** Ask the user to put their token in `.env` (copy from the main project's `.env`). Run `python -m extract`. Expected: about 30 books, most matched. Open both files and check by eye: no token, no user name, no fields outside the lists in Tasks 2 and 3.
- [ ] **Step 3: Run it again.** Expected: "newly matched: 0", no Open Library calls for cached books, files unchanged apart from `extracted_at`.
- [ ] **Step 4: Commit** (ask first): `feat: extract CLI and first raw extract`.

---

### Task 5: dbt project, sources and staging

**Files:**
- Create: `dbt/dbt_project.yml`, `dbt/profiles.yml`, `dbt/macros/english_text.sql`, `dbt/models/sources.yml`, `dbt/models/staging/*.sql`, `dbt/models/staging/staging.yml`

**Interfaces:**
- Consumes: `data/raw/*.json`.
- Produces (DuckDB, schema `staging`):
  - `stg_hardcover__books(hardcover_id varchar, title varchar, author varchar /* first author, latin_or_null */, authors varchar[] , isbn_13, isbn_10, rating_10 double /* rating * 2 */, shelf_status varchar, extracted_at timestamptz)`. `shelf_status` from `status_id`: 1 `want_to_read`, 2 `reading`, 3 `read`, 5 `did_not_finish`, else `unknown`.
  - `stg_hardcover__reads(hardcover_id, read_number int, finished_at date /* nullable */)`: only `shelf_status = 'read'`; one row per finish date; one row with null `finished_at` when the list is empty.
  - `stg_openlibrary__books(hardcover_id, ol_key, author_name, first_publish_year, page_count, cover_url /* https://covers.openlibrary.org/b/id/{cover_id}-L.jpg or null */, publisher, extracted_at)`.
  - `stg_openlibrary__subjects(hardcover_id, subject_name)`: unnested, trimmed, distinct, non-empty, `not is_non_english_subject(...)`.

- [ ] **Step 1: Project config.** `profiles.yml` in `dbt/` with target `prod`, `type: duckdb`, `path: "{{ env_var('WAREHOUSE_PATH', '../warehouse.duckdb') }}"`. `dbt_project.yml`: name `reading_library`, model schemas `staging`, `marts`, `metrics`, `publish` (override `generate_schema_name` so the names are used as is), `vars: {minutes_per_page: 1.5, words_per_minute: 238}`.
- [ ] **Step 2: Sources.** `sources.yml` source `raw` with tables `hardcover_books` and `openlibrary_books`, each with `meta.external_location: "read_json('../data/raw/{name}.json', format='array')"`, `loaded_at_field: "extracted_at::timestamptz"`, `freshness: {warn_after: {count: 36, period: hour}, error_after: {count: 72, period: hour}}`.
- [ ] **Step 3: Port the macros.** Copy `has_non_latin_script`, `latin_or_null`, `is_non_english_subject` from the main project's `dbt/macros/english_text.sql` to DuckDB syntax: `regexp_matches(col, pattern)` instead of `~`, `\b` instead of `\m` and `\M` (DuckDB's RE2 has no `\m`), `nfc_normalize(col)` instead of `normalize(col, NFC)`.
- [ ] **Step 4: Write the four staging models and `staging.yml` tests:** `unique` + `not_null` on `stg_hardcover__books.hardcover_id` and `stg_openlibrary__books.hardcover_id`; `accepted_values` on `shelf_status` (`want_to_read, reading, read, did_not_finish, unknown`). No dbt packages: range checks use the small generic test written in Task 6.
- [ ] **Step 5: Run** `cd dbt && dbt build --select staging --profiles-dir .`. Expected: all models and tests PASS. Then `dbt source freshness --profiles-dir .`. Expected: PASS.
- [ ] **Step 6: Commit** (ask first): `feat: dbt sources and staging for books`.

---

### Task 6: Star schema

**Files:**
- Create: `dbt/models/marts/*.sql`, `dbt/models/marts/marts.yml`

**Interfaces:**
- Consumes: Task 5 staging models.
- Produces (schema `marts`):
  - `dim_item(item_id varchar /* 'book:'||hardcover_id */, item_type /* 'book' */, title, cover_or_image_url, url /* https://openlibrary.org{ol_key} or https://hardcover.app */, page_count, word_count /* null for books */, first_published_year, shelf_status, rating_10, source_id)`. One row per Hardcover book, matched or not. DNF and unknown excluded.
  - `dim_creator(creator_id /* md5(lower(name)) */, creator_name)`; `bridge_item_creator(item_id, creator_id, creator_order int)`. Names from Hardcover `authors`, each passed through `latin_or_null`; for the first author, Open Library `author_name` wins when Hardcover's is null after the Latin check.
  - `dim_source(source_id /* md5(lower(name)) */, source_name, source_kind /* 'publisher' */)`.
  - `dim_topic(topic_id, topic_name, is_generic boolean)` with the main project's generic list and patterns (`dim_book_subject.sql`), regex ported as in Task 5; `bridge_item_topic(item_id, topic_id)`.
  - `dim_date(date_id int /* yyyymmdd */, date, year, month, month_name, season, weekday)` from Jan 1 of the earliest finish year to Dec 31 of the current year.
  - `fact_reading(reading_id /* md5(item_id||read_number) */, item_id, date_id /* nullable */, rating_10, status /* 'read' */, reading_minutes double)`. `reading_minutes = page_count * var('minutes_per_page')`, null when `page_count` is null.

- [ ] **Step 1: Write the dbt unit tests in `marts.yml` first** (dbt 1.8+ `unit_tests`, mocking the staging inputs):
  - `fact_reading_one_row_per_reread`: one book with `finished_at` 2024-01-09 and 2025-03-01 gives 2 rows with date_ids 20240109 and 20250301.
  - `fact_reading_undated_read_kept`: a read book with no finish date gives 1 row with null `date_id`.
  - `fact_reading_excludes_unfinished`: books with `shelf_status` `want_to_read`, `reading`, `did_not_finish`, each with a rating, give 0 rows (staging already limits reads to `read`; this test pins it at the fact).
  - `dim_item_keeps_unmatched_book`: a Hardcover book with no Open Library row appears with null cover, null page_count.
  - `dim_item_drops_dnf`: a `did_not_finish` book is not in `dim_item`.
- [ ] **Step 2: Run** `dbt test --select "test_type:unit" --profiles-dir .`. Expected: FAIL (models missing).
- [ ] **Step 3: Write the models.**
- [ ] **Step 4: Schema tests in `marts.yml`:** `unique`/`not_null` on every primary key; `relationships` from `fact_reading.item_id` to `dim_item`, `fact_reading.date_id` to `dim_date` (`where: date_id is not null`), `dim_item.source_id` to `dim_source` (`where: source_id is not null`), both bridge tables to their dims; `accepted_values` `item_type in (book, article, newsletter_post)`; singular-style `expression` check via a generic test `dbt/tests/generic/between.sql` (`{% test between(model, column_name, min, max) %}`) applied to `rating_10` with 0 and 10.
- [ ] **Step 5: Run** `dbt build --select staging marts --profiles-dir .`. Expected: all PASS. Spot check: `select count(*) from marts.fact_reading` equals the number of read books plus re-reads.
- [ ] **Step 6: Commit** (ask first): `feat: star schema for books with unit tests`.

---

### Task 7: Metric layer, publish layer, privacy and consistency tests

**Files:**
- Create: `dbt/models/metrics/*.sql`, `dbt/models/metrics/metrics.yml`, `dbt/models/publish/*.sql`, `dbt/models/publish/publish.yml`, `dbt/seeds/allowed_published_columns.csv`, `dbt/tests/assert_published_columns_allowed.sql`, `dbt/tests/assert_metrics_agree.sql`

**Interfaces:**
- Consumes: Task 6 marts.
- Produces (decision: plain dbt models, the spec's builder's choice; each metric's definition written once in `metrics.yml` `description`):
  - `metric_items_read(item_type, items_read)`
  - `metric_books_by_period(finish_year int, finish_month int, books_read)`: dated reads only.
  - `metric_pages_read(finish_year /* nullable */, pages_read)`: sum of `page_count` per read.
  - `metric_reading_time(item_type, finish_year /* nullable */, reading_minutes)`
  - `metric_avg_rating(dimension /* 'type' | 'topic' | 'creator' */, dimension_value, avg_rating_10, rated_reads)`: generic topics excluded.
  - `metric_top_creators(creator_name, items_read, avg_rating_10, rank)`: ordered by items read, then average rating.
  - `metric_topic_mix(topic_name, reads, share)`: non-generic topics; `share` over reads that have at least one topic.
  - `metric_long_form_share(item_type, reading_minutes, share)`
  - `metric_undated_reads(item_type, undated_reads)`
  - `pub_shelf(item_id, title, author, cover_url, url, page_count, first_published_year, shelf_status, rating_10, finish_dates date[], last_finished date, topics varchar[] /* non-generic */)`: one row per item; the only table the shelf pages read.
  - `pub_build_info(built_at timestamptz, hardcover_extracted_at timestamptz, items_on_shelves int)`.

- [ ] **Step 1: Write the failing singular tests.**
  - `assert_published_columns_allowed.sql`: select every `(table_schema, table_name, column_name)` from `information_schema.columns` where schema in (`metrics`, `publish`) that is not in seed `allowed_published_columns` (columns `table_name,column_name`, one row per allowed column). Any row fails the test. This is the spec's "no private fields" check.
  - `assert_metrics_agree.sql`: fails if `metric_items_read` (books) differs from `count(*)` of `fact_reading`, if `sum(books_read)` from `metric_books_by_period` plus `metric_undated_reads` (books) differs from `metric_items_read` (books), or if `sum(pages_read)` over all years differs from the pages of all reads.
- [ ] **Step 2: Write the seed** listing exactly the columns above.
- [ ] **Step 3: Write the metric and publish models.**
- [ ] **Step 4: Run** `dbt build --profiles-dir .`. Expected: all models, seeds, unit and data tests PASS.
- [ ] **Step 5: Prove the privacy test bites.** Temporarily add `isbn_13` to `pub_shelf`, run `dbt test --select assert_published_columns_allowed`, expect FAIL, revert.
- [ ] **Step 6: Docs.** `dbt docs generate --profiles-dir .` succeeds. Add descriptions to every mart and metric model.
- [ ] **Step 7: Commit** (ask first): `feat: metric and publish layers with privacy and consistency tests`.

---

### Task 8: CI on pull requests

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: committed `data/raw/*.json`, Tasks 1 to 7. Site build step is added in Task 9.

- [ ] **Step 1: Write `ci.yml`** on `pull_request` and `push` to `main`: checkout; `actions/setup-python@v5` 3.12 with pip cache; `pip install -r requirements-dev.txt`; `ruff check .`; `pytest -q`; `cd dbt && dbt build --profiles-dir .` with `WAREHOUSE_PATH=${{ runner.temp }}/warehouse.duckdb`. No secrets: CI builds from the committed raw files.
- [ ] **Step 2: Verify locally** the same commands in order. Expected: all PASS.
- [ ] **Step 3: Commit** (ask first): `ci: lint, tests and dbt build on pull requests`.

---

### Task 9: Site skeleton, theme, data loaders and spine maths

**Files:**
- Create: `site/package.json`, `site/observablehq.config.js`, `site/src/style.css`, `site/src/data/_warehouse.py`, `site/src/data/shelf.json.py`, `site/src/data/metrics.json.py`, `site/src/data/build.json.py`, `site/src/components/spine.js`, `site/test/spine.test.js`
- Modify: `.github/workflows/ci.yml` (add Node 20, `npm ci`, `npm test`, `npm run build` in `site/`)

**Interfaces:**
- Consumes: `publish.*` and `metrics.*` tables.
- Produces:
  - `_warehouse.py`: `connect() -> duckdb.DuckDBPyConnection` read-only on `WAREHOUSE_PATH` (default `../warehouse.duckdb` relative to the repo root).
  - `shelf.json`: array of `pub_shelf` rows (dates as ISO strings).
  - `metrics.json`: `{ "<metric table name>": [rows] }` for every table in schema `metrics`.
  - `build.json`: the single `pub_build_info` row.
  - `spine.js`: `spineWidth(pageCount: number|null): number` (px, `clamp(round(pages / 14), 22, 58)`, null gives 34); `spineHeight(itemId: string): number` (percent 84 to 100, stable hash of `itemId`); `spineColor(itemId: string): string` (one of 8 fallback cloth colours: oxblood, bottle green, navy, mustard, plum, slate, rust, walnut); `spineLabel(title: string, max = 38): string` (ellipsis past `max`); `spineStyle(book): {width, height, background}` (cover image with a darkening gradient when `cover_url`, else `spineColor`).

- [ ] **Step 1: Scaffold.** `npm create` is not used; write `package.json` by hand: dependency `@observablehq/framework` pinned to the latest 1.x at install time, scripts `dev`, `build` (`observable build`), `test` (`node --test test/`). Run `npm install` to create the lockfile. Config: `title: "The Reading Library"`, `root: "src"`, `style: "style.css"`, pages Library, Shelves, Catalogue, Year in review, How this is made; `head` loads the three Google Fonts.
- [ ] **Step 2: Write the failing tests** in `site/test/spine.test.js` (`node:test` + `node:assert`):
  - `spineWidth(null) === 34`, `spineWidth(100) === 22`, `spineWidth(420) === 30`, `spineWidth(2000) === 58`.
  - `spineHeight("book:1") === spineHeight("book:1")` and within 84..100.
  - `spineLabel("a".repeat(60)).length === 38` and ends with `"…"`.
  - `spineStyle({item_id:"book:9", cover_url:null, page_count:null}).background` is one of the fallback colours.
- [ ] **Step 3: Run** `npm test`. Expected: FAIL.
- [ ] **Step 4: Implement `spine.js`,** the loaders and `style.css` (tokens from Global Constraints; `body { background: var(--parchment); color: var(--ink); }`; small labels `font-family: "IBM Plex Mono"; letter-spacing: .25em; text-transform: uppercase; font-size: 11px; color: var(--muted)`; wood shelf class `.shelf-plank` with `repeating-linear-gradient` grain over `--walnut` and a soft shadow under the books).
- [ ] **Step 5: Run** `npm test && npm run build` (after `dbt build` locally). Expected: tests PASS, `site/dist` built, `dist/_file/data/shelf.*.json` contains about 30 rows.
- [ ] **Step 6: Commit** (ask first): `feat: site skeleton, theme and spine layout`.

---

### Task 10: The library page (main shelf, book panel, search, want-to-read shelf)

**Files:**
- Create: `site/src/components/shelf.js`, `site/src/components/bookPanel.js`, `site/src/index.md`

**Interfaces:**
- Consumes: `shelf.json`, `metrics.json`, `spine.js`.
- Produces: `Shelf(books, {onOpen}) -> HTMLElement` (a full-width, sideways-scrolling row of spines on a wood plank; reused by Tasks 11 and 13). `BookPanel(book, {onPrev, onNext, onClose}) -> HTMLElement`.

- [ ] **Step 1: `index.md` layout,** top to bottom: small label `A PERSONAL ARCHIVE`; italic display line `Welcome to my library`; label `{items_read} VOLUMES READ` from `metric_items_read`; search input placeholder `What are you looking for?` (filters title and author, case-insensitive); topic pills `All` plus the top 8 topics with at least 2 books from `metric_topic_mix`; main shelf (`read` books ordered by `last_finished` desc, undated last; `reading` books first with a small brass bookmark ribbon on top of the spine and `aria-label` "currently reading"); section label `ON MY LIST` and display line `The want-to-read shelf` with count; second shelf of `want_to_read` books.
- [ ] **Step 2: Spines.** Each spine is a `<button>` with `aria-label="{title} by {author}"`, vertical title via `writing-mode: vertical-rl`, `spineStyle` sizing, slight lift on hover and focus.
- [ ] **Step 3: Book panel.** Opens in place over a blurred shelf: cover left (fallback cloth colour with the title set in type when no cover), right side label `FINISHED {date}` or `UNDATED` or `CURRENTLY READING` or `ON MY LIST`, title, author in brass italic, rating as stars out of 5 (`rating_10 / 2`, half stars allowed, nothing when null), first published year, `Previous` / `Next` within the current filtered shelf, `Shelve it` closes. Escape closes, focus returns to the spine.
- [ ] **Step 4: Empty states.** Search with no match shows `Nothing on these shelves matches that.`; the want-to-read shelf is hidden when empty.
- [ ] **Step 5: Check in the browser** (`npm run dev`): desktop 1440px and phone 375px. On the phone the shelf scrolls sideways, the panel stacks cover above text, no horizontal page scroll. Keyboard: Tab reaches spines, Enter opens, Escape closes.
- [ ] **Step 6: Commit** (ask first): `feat: library page with shelves and book panel`.

---

### Task 11: Shelves page (by year, 5-star, undated)

**Files:**
- Create: `site/src/shelves.md`

**Interfaces:**
- Consumes: `Shelf`, `BookPanel`, `shelf.json`.

- [ ] **Step 1: Build.** Label `ARRANGED BY HAND`, display line `The shelves`. Then: `The 5-star shelf` (`rating_10 = 10`, hidden if empty); one shelf per finish year, newest first, each titled with the year and a brass plaque showing the count (a re-read appears in each year it was finished); last, `Undated` with the line `Read before I kept dates.`
- [ ] **Step 2: Check** desktop and 375px as in Task 10.
- [ ] **Step 3: Commit** (ask first): `feat: shelves by year and rating`.

---

### Task 12: Card catalogue (metrics in library form)

**Files:**
- Create: `site/src/components/catalogue.js`, `site/src/catalogue.md`

**Interfaces:**
- Consumes: `metrics.json` only (no counting in the page; one definition per number).
- Produces: `Drawers(topicMix) -> HTMLElement`, `CheckoutCard(booksByPeriod, undated) -> HTMLElement`, `Ledger(metrics) -> HTMLElement`, `AuthorCards(topCreators) -> HTMLElement`.

- [ ] **Step 1: Ledger** (a ruled ledger page): volumes read, pages read, hours of reading (`reading_minutes / 60`, rounded), average rating as stars, undated reads with the note `kept without a date`.
- [ ] **Step 2: Card catalogue cabinet:** one wooden drawer per topic from `metric_topic_mix` (top 10), drawer height proportional to `share` (minimum 28px so a 1-book topic is readable), brass label holder with topic name and read count, average rating from `metric_avg_rating` where `dimension = 'topic'` on the drawer front.
- [ ] **Step 3: Checkout card:** a library due-date card with one ink stamp per month that has reads in `metric_books_by_period` (stamp text `MAR 2025`, count as small dots), last 24 months, newest at the bottom like a real card. Below it, `{n} reads not stamped` from `metric_undated_reads`.
- [ ] **Step 4: Author cards:** top 5 from `metric_top_creators` as typed catalogue cards (`AUTHOR`, name, `{n} volumes`, average rating).
- [ ] **Step 5: Check** with the real data that numbers match the library page (`VOLUMES READ` equals the ledger), at 1440px and 375px.
- [ ] **Step 6: Commit** (ask first): `feat: card catalogue page`.

---

### Task 13: Year in review and "How this is made"

**Files:**
- Create: `site/src/year.md`, `site/src/about.md`, `scripts/copy_dbt_docs.py`

**Interfaces:**
- Consumes: `metrics.json`, `shelf.json`, `build.json`, `dbt/target/{index.html,manifest.json,catalog.json}`.
- Produces: `python scripts/copy_dbt_docs.py` copies the three dbt docs files into `site/dist/docs/` (run after `npm run build`; exits non-zero if any file is missing).

- [ ] **Step 1: Year in review.** Year picker over years present in `metric_books_by_period` (default: latest). Shows books finished, pages read and hours from the metric tables filtered by `finish_year`, the year's shelf (`Shelf` with that year's books), the highest-rated book of the year, and the year's checkout stamps. If the latest year has fewer than 3 dated books, still show it; never invent numbers for undated reads.
- [ ] **Step 2: How this is made.** `Last updated {built_at}` and `Hardcover read at {hardcover_extracted_at}` from `build.json`; `{items_on_shelves} books on the shelves`; a Mermaid pipeline diagram (Hardcover and Open Library to raw JSON to DuckDB + dbt to metrics to this site, nightly on GitHub Actions); the metric list with one-line definitions; links `Model and lineage (dbt docs)` to `./docs/` and `Source code` to the repo URL (set in `observablehq.config.js` once the repo exists).
- [ ] **Step 3: Write `copy_dbt_docs.py`** and run `npm run build && python scripts/copy_dbt_docs.py`. Expected: `site/dist/docs/index.html` opens the lineage graph locally.
- [ ] **Step 4: Commit** (ask first): `feat: year in review and how this is made`.

---

### Task 14: Nightly build and GitHub Pages deploy

**Files:**
- Create: `.github/workflows/nightly.yml`

**Interfaces:**
- Consumes: everything above; secret `HARDCOVER_API_TOKEN`.

- [ ] **Step 1: Ask the user** to create the public GitHub repo (or approve that I create it with `gh repo create`), add the `HARDCOVER_API_TOKEN` secret, and set Pages source to "GitHub Actions". Do not push without a yes.
- [ ] **Step 2: Write `nightly.yml`.** Triggers: `schedule: cron "0 3 * * *"`, `workflow_dispatch`, `push` to `main`. Permissions `contents: write, pages: write, id-token: write`. `concurrency: pages`. Job `build`: checkout; Python 3.12 and Node 20 with caches; install; on schedule and dispatch only, `python -m extract` (a failure here stops the job, so the live site and committed raw files stay as they were); `dbt build`; `dbt source freshness` (warn only); `dbt docs generate`; `npm ci && npm run build` in `site/`; `python scripts/copy_dbt_docs.py`; if `data/raw` changed, commit it as `github-actions[bot]` with message `data: nightly extract` and push; `actions/upload-pages-artifact@v3` with `site/dist`. Job `deploy` needs `build`: `actions/deploy-pages@v4`. A failed run emails the owner by default.
- [ ] **Step 3: Verify.** After the first push, run the workflow by hand; expected: green run, site live at the Pages URL, `/docs/` shows the lineage graph. Then break a test on a branch (for example `rating_10` range 0 to 5) and confirm CI fails; revert.
- [ ] **Step 4: Commit** (ask first): `ci: nightly extract, build and Pages deploy`.

---

### Task 15: README and case study

**Files:**
- Create: `README.md`
- Modify: `docs/case-study.md` (fill the "Results" and "What I learned" sections with real numbers once live)

- [ ] **Step 1: README:** live link, one screenshot of the library page, the model diagram (Mermaid star schema), the metric list, how to run locally (`python -m extract`, `dbt build`, `npm run dev`), how the nightly run works, privacy note (only the published columns leave the warehouse).
- [ ] **Step 2: Case study:** replace the placeholders in `docs/case-study.md` with measured results (books, metrics, test count, run time of the nightly job, Lighthouse score of the library page).
- [ ] **Step 3: Commit** (ask first): `docs: README and case study results`.
