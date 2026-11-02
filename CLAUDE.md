# Reading Library

Public static website of everything I have read (books from Hardcover, plus saved articles), designed to feel like a real library. Underneath it is a small BI project: DuckDB warehouse modelled with dbt, metrics defined once, nightly GitHub Actions build, hosted free on GitHub Pages.

Full design: `docs/superpowers/specs/2026-11-03-reading-library-design.md`.

## Where we are (2026-11-03)

Brainstorming is done. Open questions answered and visual inspiration added to the design (section 10: like https://carollia-library.lovable.app/ but warmer and more classic, wood shelves). The design is waiting for my final approval. Nothing is built yet. This folder is not a git repo yet.

Next steps, in order:

Plan: `docs/superpowers/plans/2026-11-03-reading-library-books.md` (books only; articles get their own plan later), run natively. Pipeline (Tasks 1 to 8) is built and tested but not committed yet; the build ledger is in `.superpowers/sdd/2026-11-03-reading-library-books/progress.md`.

Next: the website, Tasks 9 to 15, then one whole-project review.

Run locally: `.venv/Scripts/python -m extract` (needs HARDCOVER_API_TOKEN), then `cd dbt && ../.venv/Scripts/dbt build --profiles-dir .`.

Portfolio write-up: `docs/case-study.md` (problem statement, approach, decisions; results filled after launch).

## Decisions on the former open questions

1. Articles: Raindrop or Google Form/Sheet, decided before build step 6.
2. Metrics: section 9 list confirmed as is.
3. The library shows read, currently reading and want-to-read books (a "want to read" shelf below the main one). Only finished reads count in metrics.

## How the decisions came about

- Mostly personal, also for my data / BI engineering portfolio. The BI side (modelled warehouse and metrics) is the engineering focus; the UI is the MVP and must feel like a real library, not a dashboard.
- Separate project from `../Personal Content Intelligence Pipeline`. That project runs locally with no auth and cannot be hosted; this one is public, static and books/articles only, so nothing private can leak.
- Free to host, light tooling, small data (about 30 books, roughly half with a finish date).
- I do not track articles today; Raindrop.io (free, share button, API) was suggested.

## Reuse from the main project (copy, do not import)

- Hardcover GraphQL query and ingestion rules: `../Personal Content Intelligence Pipeline/dagster/ops/hardcover_op.py` (never delete history on an empty response).
- Open Library matching, English titles and author names, generic subject rules: `../Personal Content Intelligence Pipeline/dagster/ops/openlib_op.py` and `dbt/models/marts/dim_book_subject.sql`.

## Working preferences

- No AI attribution in commits (no Co-Authored-By trailer), and no AI-sounding writing such as em-dashes.
- Commit only when asked; never push without asking.
