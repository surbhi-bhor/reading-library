{{ config(materialized='ephemeral') }}
-- Every credited author per item, in credit order. Hardcover's name wins;
-- Open Library's English name fills in when Hardcover's first author is
-- not in Latin script.
with books as (
    select b.hardcover_id, b.authors, ol.author_name as ol_author
    from {{ ref('stg_hardcover__books') }} as b
    left join {{ ref('stg_openlibrary__books') }} as ol using (hardcover_id)
    where b.shelf_status in ('read', 'reading', 'want_to_read')
),

credited as (
    select
        'book:' || hardcover_id as item_id,
        cast(r.i as integer) as creator_order,
        case when r.i = 1 then coalesce({{ latin_or_null('authors[r.i]') }}, ol_author)
             else {{ latin_or_null('authors[r.i]') }} end as creator_name
    from books, range(1, len(authors) + 1) as r(i)
    union all
    select 'book:' || hardcover_id, 1, ol_author
    from books
    where len(authors) = 0
)

select item_id, creator_order, trim(creator_name) as creator_name, md5(lower(trim(creator_name))) as creator_id
from credited
where creator_name is not null
