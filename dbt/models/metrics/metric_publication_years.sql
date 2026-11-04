with books as (
    select distinct f.item_id, i.page_count, i.first_published_year, i.genre
    from {{ ref('fact_reading') }} f
    join {{ ref('dim_item') }} i using (item_id)
    where i.item_type = 'book'
)

-- Finished books by the year they were first published (Open Library).
select first_published_year, count(*) as books
from books
where first_published_year is not null
group by 1
