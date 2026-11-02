# Reading Library: design

Status: draft for review, 2026-11-03. Open questions answered and visual inspiration added the same day (sections 6, 8, 9, 10). Separate project from the Personal Content Intelligence Pipeline.

## 1. What this is and why

A public website of everything I have read: books, plus articles and newsletter posts. It should feel like walking up to a real library, not scrolling a list or reading a dashboard.

Underneath it is a small, properly modelled BI project: a dimensional warehouse with metrics defined once and reused by every page. That is what makes it a portfolio piece for a data / BI engineering profile, and it gives me something the main project cannot: a live public URL.

Who it is for, in order:

1. Me: a personal library I enjoy browsing and that keeps itself up to date.
2. Friends: a link I can share.
3. Recruiters: a portfolio link that shows warehouse modelling, metrics, data quality and automated delivery.

## 2. Goals

- The UI is the MVP. It must feel like a real library. The visual direction is in section 10.
- One reading history across item types: books from Hardcover, articles and posts saved deliberately.
- A dimensional model (star schema) and a metric layer: every number on the site comes from one definition.
- Updates itself every night with no laptop involved. Logging a read in Hardcover, or saving an article, is the only manual step.
- Free to host and run. Light tooling, sized for a small dataset (about 30 books today, growing slowly).
- Visible engineering: tests, freshness, and the lineage docs published next to the site.

## 3. Non-goals (version 1)

- No login, no server, no database server. Fully static.
- No writing back to Hardcover or the bookmark app.
- No recommendations or AI features (those live in the main project).
- No reading-status history (snapshots of want-to-read to reading to read). Possible version 2.
- No Wikidata author enrichment (nationality, era). Possible version 2.
- No highlights or notes import.

## 4. Anti-goals (would be a failure even if it works)

- It looks like a generic BI dashboard or an admin panel.
- Anything private leaks: watch history, dismissals, picks, tokens, or anything from the main project.
- Numbers disagree between pages, or a chart breaks because half the books have no finish date.
- Hosting or tooling starts costing money, or a run needs my laptop.
- Logging an article takes more than a few seconds, so I stop doing it.

## 5. Constraints

- Free: GitHub (public repo), GitHub Actions, GitHub Pages. No paid APIs or services.
- Small, sparse data: about 30 books, roughly half with a finish date; articles start at zero. Every view must still look good with this.
- Secrets (Hardcover token, bookmark-app token) live only in GitHub Actions secrets. They must never reach the built site.
- English display text (same rule as the main project).

## 6. Sources

| Source | What it gives | How |
|---|---|---|
| Hardcover GraphQL API | My books: status, rating, finish dates, title, authors, ISBNs | Same query shape as `dagster/ops/hardcover_op.py` in the main project (fields `user_books { rating status_id user_book_reads { finished_at } book { title contributions editions } }`). Copied, not imported. |
| Open Library | Covers, subjects, page counts, first publish year | Search by ISBN, then title and author, as in `openlib_op.py` of the main project. |
| Raindrop.io API (articles) | Saved articles in a "Read" collection: URL, title, excerpt, tags, date saved | Free plan, personal API token. Save via the phone share sheet or browser extension once finished. |
| The article page itself | Author, publication, word count / reading time | Read the page's Open Graph and meta tags at ingestion. Best effort: paywalled pages may give only the title. |

Not decided yet. Raindrop is the front runner because it is free, has a share button and an API, and tags give a free dimension; a Google Form/Sheet is the fallback. I decide before build step 6. Nothing before step 6 depends on this.

## 7. Architecture

```
Hardcover API ─┐
Open Library ──┼─► Python extract (raw JSON/Parquet) ─► DuckDB file ─► dbt (staging ─► marts ─► metrics)
Raindrop API ──┤                                                              │
Article pages ─┘                                                              ▼
                                                     Observable Framework site (reads DuckDB at build time)
                                                                              │
                                                                              ▼
                                                                        GitHub Pages
```

All of it runs in one nightly GitHub Actions workflow:

1. Extract: call the APIs, write raw files.
2. Load: into a DuckDB file (`warehouse.duckdb`).
3. `dbt build`: models plus tests; a failing test stops the deploy, so the live site keeps yesterday's good data.
4. Export: the site's data loaders query the metric and mart tables.
5. Build and deploy the static site, plus the dbt docs (lineage graph) at `/docs`.

The raw extracts are committed or cached between runs so a failed API call does not wipe data (same "never delete on an empty response" rule as the main project).

## 8. The warehouse model

Grain of the main fact: one row per finished read of one item.

- `fact_reading` (one row per item read; a re-read book gets one row per finish)
  - `reading_id`, `item_id`, `date_id` (finish date, nullable), `rating` (0 to 10, nullable), `status`, `reading_minutes` (estimated: pages times a fixed rate for books, word count divided by reading speed for articles)
- `dim_item`: one row per book or article
  - `item_type` (book, article, newsletter post), `title`, `cover_or_image_url`, `url`, `page_count`, `word_count`, `first_published_year`
  - `shelf_status` (read, currently reading, want to read): today's status from Hardcover, used only to place the item on a shelf. Want-to-read and currently-reading items have no row in `fact_reading`, so they never count in a metric.
- `dim_creator`: authors and article writers, one row per person, with a bridge `bridge_item_creator` for multi-author books
- `dim_source`: where it was published: a publisher, Substack, Medium, a news site (derived from the article URL's domain or the book's publisher)
- `dim_topic` and `bridge_item_topic`: Open Library subjects for books and Raindrop tags for articles, mapped into one topic list; generic tags ("Fiction", shelf categories ending in ", general") flagged and ignored, as in the main project
- `dim_date`: calendar table for year, month, season, weekday

Staging models clean each source (one per source); marts join them into the star above.

## 9. Metrics

Defined once in the dbt semantic layer (MetricFlow YAML on top of `fact_reading`) and materialized into a small set of metric tables that the site reads. Every page uses these, never its own SQL for the same number.

Confirmed set for version 1:

| Metric | Definition |
|---|---|
| Items read | Count of finished reads, by type |
| Books per year / month | Finished books with a finish date |
| Pages read | Sum of page counts of finished books |
| Reading time | Sum of estimated reading minutes, books and articles together |
| Average rating | Mean of rated reads, by type, topic, creator |
| Top creators | Creators by items read, then average rating |
| Topic mix | Share of reads per topic |
| Long-form share | Articles vs books by reading time |
| Undated reads | Count of reads without a finish date (shown honestly, not hidden) |

Builder's choice: if MetricFlow with DuckDB proves heavy in CI, define the same metrics as plain dbt models in a `metrics` folder with the definitions documented in YAML. The rule that matters is "one definition per number".

## 10. The site (UI is the MVP)

### Visual direction

Inspiration: https://carollia-library.lovable.app/ (something similar, not a copy). What to take from it:

- One calm page: a large italic serif welcome line, a volume count, small letter-spaced labels, a search line and topic pills above the shelf.
- One long, full-width shelf of spines that runs edge to edge. Spines are painted from the cover art, with varied heights and widths, so the shelf looks real even with few books.
- Clicking a spine opens the book in place: big cover on the left, title, author, my rating, finish date on the right, previous and next links, the shelf blurred behind.
- A second shelf further down for books I want to read.

Where mine differs: warmer and more classic. Wood shelves with a visible grain and a shadow under the books, warm parchment and dark walnut tones instead of the cool off-white, an older-feeling serif for headings, brass or ink accents. Still quiet and readable, never a theme-park library.

### What the UI must do

- The shelf: every book as a spine on a shelf, spine width from page count, colour and art from the cover. Clicking pulls the book out: cover, author, my rating, finish date.
- Shelves by status: the main shelf of read books (books I am reading now sit at its start with a small bookmark marker), then a "want to read" shelf below.
- Articles have their own place in the library (for example a reading room, a newspaper rack, or a pinboard; decided with the inspiration).
- Different shelves: by year, by topic, by rating ("the 5-star shelf").
- Data shown in library form, not as a dashboard, for example a card catalogue where drawer thickness is the topic mix, checkout stamps as the reading timeline, a year-in-review page.
- A small "how this is made" corner: last updated, number of items, a diagram of the pipeline, link to the dbt docs and the repo.
- Works on a phone.

## 11. Data quality and freshness

- dbt tests: unique and not-null keys, relationships between facts and dimensions, ratings in 0 to 10, item types from an accepted list.
- A test that the published tables contain no private fields (only the allowed columns).
- Source freshness on each extract; the site shows "last updated" and the run status.
- If an extract returns nothing, keep the previous data and fail the run loudly (GitHub Actions email).

## 12. Repo and tooling

- New public GitHub repo, local folder next to the main project.
- Python for extraction (requests, small and plain), DuckDB, dbt-core with dbt-duckdb, Observable Framework (Node) for the site.
- Same habits as the main project: ruff, pytest for the extractors, CI on pull requests, pinned versions.
- README with the live link, a screenshot, the model diagram and the metric list.

## 13. Build order

1. Repo skeleton, CI, and the Hardcover extractor loading into DuckDB.
2. dbt staging and marts for books, with tests. Publish the dbt docs.
3. Metric layer for books.
4. UI: build the library shelf from my inspiration, on real data. This is the biggest phase.
5. Nightly workflow and GitHub Pages deploy; site live with books only.
6. Raindrop extractor, article enrichment, article models and metrics, the articles area of the UI.
7. Polish: year in review, "how this is made" corner, README, portfolio write-up.

The site is usable and public after step 5; articles come after.

## 14. Calls I made (please check)

- Separate repo; reuse the main project's Hardcover and Open Library logic by copying, not importing.
- DuckDB + dbt-duckdb as the warehouse, Observable Framework for the site, GitHub Actions + GitHub Pages for running and hosting.
- Article logging (Raindrop.io or Google Form/Sheet) decided before build step 6.
- Nightly updates (not real time).
- Version 1 leaves out status-history snapshots, Wikidata, highlights, recommendations.
- The metric list in section 9 (confirmed).
- The library shows read, currently reading and want-to-read books; only finished reads count in metrics.
- The look: inspired by the site in section 10, warmer and more classic.

## 15. Left to the builder

- Exact folder layout, Python package structure, and data loader format.
- Reading-speed constants for estimated minutes.
- Topic mapping details between Open Library subjects and Raindrop tags.
- Chart library choices inside Observable Framework.
