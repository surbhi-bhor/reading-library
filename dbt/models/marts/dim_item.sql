-- One row per book on a shelf (read, reading, want to read). Abandoned and
-- unknown-status books are not shown. Unmatched books stay, with nulls.
select
    'book:' || b.hardcover_id as item_id,
    'book' as item_type,
    b.title,
    ol.cover_url as cover_or_image_url,
    -- A Goodreads search on title and author: Open Library work pages often open
    -- on a translated edition, and Goodreads has no public API to link exactly.
    'https://www.goodreads.com/search?q='
        || url_encode(trim(split_part(b.title, ':', 1)) || coalesce(' ' || b.author, '')) as url,
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
where b.shelf_status in ('read', 'reading', 'want_to_read')
