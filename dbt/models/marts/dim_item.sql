-- One row per item on a shelf: books from Hardcover (read, reading, want to
-- read; abandoned and unknown-status books are not shown, unmatched books stay
-- with nulls) and articles from Raindrop (every bookmark is a finished read).
select
    'book:' || b.hardcover_id as item_id,
    'book' as item_type,
    b.title,
    -- Open Library's cover first. Hardcover's otherwise, through the wsrv.nl image
    -- proxy, because Hardcover's image host sends no CORS header and the shelf
    -- paints covers onto a canvas.
    -- A hand-picked cover (seed cover_overrides) beats both sources.
    case
        when o.cover_url is not null then 'https://wsrv.nl/?w=400&url=' || url_encode(o.cover_url)
        else coalesce(ol.cover_url, 'https://wsrv.nl/?w=400&url=' || url_encode(b.hardcover_cover_url))
    end as cover_or_image_url,
    -- The cover shown large (the book in hand, the picks, the book taken off
    -- the shelf): Hardcover's sharpest edition cover when it is at least as tall
    -- as Open Library's, which is at most 500px and often only 360px. Always
    -- through the proxy: it sends CORS headers, caches Open Library's slow
    -- covers, and serves an 800px WebP without enlarging small images.
    'https://wsrv.nl/?w=800&q=85&we&output=webp&url=' || url_encode(case
        when o.cover_url is not null then o.cover_url
        when b.hardcover_cover_url is not null and (coalesce(b.hardcover_cover_height, 0) >= 500 or ol.cover_url is null)
            then b.hardcover_cover_url
        else ol.cover_url
    end) as cover_hd_url,
    coalesce(b.description, ol.description) as summary,
    -- Goodreads opens the exact book from its ISBN (/book/isbn/ redirects to the
    -- edition page). Without an ISBN, fall back to a search on title and author.
    case
        when coalesce(b.isbn_13, b.isbn_10) is not null
            then 'https://www.goodreads.com/book/isbn/' || coalesce(b.isbn_13, b.isbn_10)
        else 'https://www.goodreads.com/search?q='
            || url_encode(trim(split_part(b.title, ':', 1)) || coalesce(' ' || b.author, ''))
    end as url,
    ol.page_count,
    null::integer as word_count,
    ol.first_publish_year as first_published_year,
    b.shelf_status,
    b.rating_10,
    coalesce(g.genre, 'Fiction') as genre,
    case when ol.publisher is not null then md5(lower(ol.publisher)) end as source_id
from {{ ref('stg_hardcover__books') }} as b
left join {{ ref('stg_openlibrary__books') }} as ol using (hardcover_id)
left join {{ ref('int_item_genre') }} as g using (hardcover_id)
left join {{ ref('cover_overrides') }} as o on o.hardcover_id = b.hardcover_id
where b.shelf_status in ('read', 'reading', 'want_to_read')

union all

select
    a.read_id as item_id,
    'article' as item_type,
    a.title,
    -- The preview image a share shows, through the same proxy as book covers
    -- (CORS headers, so the shelf can read its colour).
    case when a.cover_url is not null then 'https://wsrv.nl/?w=400&url=' || url_encode(a.cover_url) end as cover_or_image_url,
    case when a.cover_url is not null then 'https://wsrv.nl/?w=800&q=85&we&output=webp&url=' || url_encode(a.cover_url) end as cover_hd_url,
    a.note as summary,
    a.url,
    null as page_count,
    null as word_count,
    null as first_published_year,
    a.status as shelf_status,
    null as rating_10,
    'Articles' as genre,
    case when a.source is not null then md5(lower(a.source)) end as source_id
from {{ ref('stg_raindrop__articles') }} as a
where a.status = 'read' and a.url like 'https://%'
