with per_creator as (
    select c.creator_name, count(*) as items_read, avg(f.rating_10) as avg_rating_10
    from {{ ref('fact_reading') }} f
    join {{ ref('bridge_item_creator') }} b using (item_id)
    join {{ ref('dim_creator') }} c using (creator_id)
    group by c.creator_name
)

select creator_name, items_read, avg_rating_10,
    cast(row_number() over (order by items_read desc, avg_rating_10 desc nulls last, creator_name) as integer) as rank
from per_creator
