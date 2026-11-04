-- The "Recommended to me" shelf: one row per book however many readers sent
-- it. The name and note shown come from the earliest recommendation of that
-- book that gave them.
with recs as (
    select *, coalesce(ol_key, lower(trim(split_part(title, ':', 1)))) as book_key
    from {{ ref('stg_supabase__recommendations') }}
),

books as (
    select
        book_key,
        min(rec_id) as rec_id,
        any_value(title order by recommended_on, rec_id) as title,
        any_value(author order by recommended_on, rec_id) as author,
        any_value(cover_id order by recommended_on, rec_id) as cover_id,
        any_value(ol_key) as ol_key,
        max(recommended_on) as recommended_on
    from recs
    group by book_key
),

words as (
    select book_key, recommended_by, note
    from recs
    where recommended_by is not null or note is not null
    qualify row_number() over (partition by book_key order by recommended_on, rec_id) = 1
),

shelf as (
    select
        b.rec_id,
        b.title,
        b.author,
        b.cover_id,
        b.ol_key,
        w.recommended_by,
        w.note,
        b.recommended_on
    from books as b
    left join words as w using (book_key)
)

select
    rec_id,
    title,
    author,
    'https://covers.openlibrary.org/b/id/' || cover_id || '-M.jpg' as cover_url,
    'https://covers.openlibrary.org/b/id/' || cover_id || '-L.jpg' as cover_hd_url,
    'https://openlibrary.org' || ol_key as url,
    recommended_by,
    note,
    recommended_on
from shelf
