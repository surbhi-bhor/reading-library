select
    hardcover_id::varchar as hardcover_id,
    title,
    -- First author, Latin script only, stray double spaces collapsed.
    regexp_replace(trim({{ latin_or_null('authors[1]') }}), '\s+', ' ', 'g') as author,
    authors,
    isbn_13,
    isbn_10,
    -- Hardcover rates 0 to 5 in half stars; the warehouse stores 0 to 10.
    rating * 2 as rating_10,
    case status_id
        when 1 then 'want_to_read'
        when 2 then 'reading'
        when 3 then 'read'
        when 5 then 'did_not_finish'
        else 'unknown'
    end as shelf_status,
    finished_dates,
    -- Hardcover's crowd-sourced genre tags (older raw files may lack the field).
    coalesce(genres, []::varchar[]) as genres,
    extracted_at::timestamptz as extracted_at
from {{ source('raw', 'hardcover_books') }}
