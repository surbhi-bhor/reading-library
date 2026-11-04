# Reading Library

Public static website of everything I have read (books from Hardcover, plus saved articles), designed to feel like a real library. Underneath it is a small BI project: DuckDB warehouse modelled with dbt, metrics defined once, nightly GitHub Actions build, hosted free on GitHub Pages.

Full design: `docs/superpowers/specs/2026-11-03-reading-library-design.md`.

## Where we are (2026-11-03)

Brainstorming is done. Open questions answered and visual inspiration added to the design (section 10: like https://carollia-library.lovable.app/ but warmer and more classic, wood shelves). The design is waiting for my final approval. Nothing is built yet. This folder is not a git repo yet.

Next steps, in order:

Plan: `docs/superpowers/plans/2026-11-03-reading-library-books.md` (books only; articles get their own plan later), run natively. Pipeline and website are built, reviewed and committed; the build ledger (rulings, deferred minors) is in `.superpowers/sdd/2026-11-03-reading-library-books/progress.md`.

Genres are fully automatic (rules in `dbt/seeds/genre_rules.csv` over Open Library subjects, Hardcover genre tags and the title, then the author's usual genre, then Fiction). Book links go to a Goodreads search.

Recommendations (built 2026-11-04): visitors recommend books through a Supabase table (`supabase/recommendations.sql`, insert-only for the public anon key); the nightly extract reads every row with the service key; a book that checks out on Open Library goes on the shelf by itself (Open Library's title, author and cover, never the visitor's text); no approval step: the visitor's name and note show too ("Recommended by …" above the title, the note under the author), dropped if they contain a link; books Open Library cannot find never show; output in `data/raw/recommendations.json`, dbt builds `pub_recommendations`, the home page shows a "Recommended to me" shelf. Needs a Supabase project: run the SQL, then set repo variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` and secret `SUPABASE_SERVICE_KEY`. Delete a row in the Supabase table editor to take a book off the shelf.

Before launch or any commit: delete the test recommendations listed in `.superpowers/test-recommendations.md` (made-up test data in Supabase), rerun the extract, and check `data/raw/recommendations.json` is clean.

Live since 2026-11-04 at https://reading-library-psi.vercel.app (public repo; GitHub Actions builds and deploys to Vercel with VERCEL_TOKEN secret and VERCEL_ORG_ID/VERCEL_PROJECT_ID variables; earlier on GitHub Pages; secrets HARDCOVER_API_TOKEN and RAINDROP_TOKEN, variables SUPABASE_URL and SUPABASE_ANON_KEY). Still to do: delete the test recommendations, then add the SUPABASE_SERVICE_KEY secret; fill the case study results.

Run locally: `.venv/Scripts/python -m extract` (needs HARDCOVER_API_TOKEN), then `cd dbt && ../.venv/Scripts/dbt build --profiles-dir .`.

Portfolio write-up: `docs/case-study.md` (problem statement, approach, decisions; results filled after launch).

## Decisions on the former open questions

1. Articles: Raindrop (decided 2026-11-04, built). Every Raindrop bookmark (any collection, not the trash) counts as a read article: save it from the Substack or Medium share button once finished; the first tag is its topic, the note shows on the site. `extract/raindrop.py` reads it with `RAINDROP_TOKEN` (optional: without it, or if Raindrop is down, books still update and saved articles stay).
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
