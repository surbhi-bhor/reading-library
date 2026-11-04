with books as (
    select distinct f.item_id, i.page_count, i.first_published_year, i.genre
    from {{ ref('fact_reading') }} f
    join {{ ref('dim_item') }} i using (item_id)
    where i.item_type = 'book'
)

-- Finished books by fiction or non-fiction, from each book's genre shelf.
select coalesce(k.kind, 'Unknown') as kind, count(*) as books, count(*) / sum(count(*)) over () as share
from books b
left join {{ ref('genre_kinds') }} k using (genre)
group by 1
