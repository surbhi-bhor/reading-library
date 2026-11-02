-- One row per book on a shelf (read, reading, want to read). Abandoned and
-- unknown-status books are not shown. Unmatched books stay, with nulls.
select
    'book:' || b.hardcover_id as item_id,
    'book' as item_type,
    b.title,
    ol.cover_url as cover_or_image_url,
    coalesce('https://openlibrary.org' || ol.ol_key, 'https://hardcover.app') as url,
    ol.page_count,
    null::integer as word_count,
    ol.first_publish_year as first_published_year,
    b.shelf_status,
    b.rating_10,
    case when ol.publisher is not null then md5(lower(ol.publisher)) end as source_id
from {{ ref('stg_hardcover__books') }} as b
left join {{ ref('stg_openlibrary__books') }} as ol using (hardcover_id)
where b.shelf_status in ('read', 'reading', 'want_to_read')
