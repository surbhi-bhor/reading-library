with books as (
    select distinct f.item_id, i.page_count, i.first_published_year, i.genre
    from {{ ref('fact_reading') }} f
    join {{ ref('dim_item') }} i using (item_id)
    where i.item_type = 'book'
)

-- Moods readers gave my finished books: how many books carry each, and the
-- share of books with any mood tag. A book has several moods, so shares overlap.
, tagged as (
    select b.item_id, m.mood from books b join {{ ref('bridge_item_mood') }} m using (item_id)
)
select mood, count(distinct item_id) as books,
    count(distinct item_id) / (select count(distinct item_id) from tagged) as share
from tagged
group by mood
