with rated as (
    select f.item_id, f.rating_10, i.item_type
    from {{ ref('fact_reading') }} f join {{ ref('dim_item') }} i using (item_id)
    where f.rating_10 is not null
)

select 'type' as dimension, item_type as dimension_value, avg(rating_10) as avg_rating_10, count(*) as rated_reads
from rated group by item_type
union all
select 'topic', t.topic_name, avg(r.rating_10), count(*)
from rated r
join {{ ref('bridge_item_topic') }} b using (item_id)
join {{ ref('dim_topic') }} t using (topic_id)
where not t.is_generic
group by t.topic_name
union all
select 'creator', c.creator_name, avg(r.rating_10), count(*)
from rated r
join {{ ref('bridge_item_creator') }} b using (item_id)
join {{ ref('dim_creator') }} c using (creator_id)
group by c.creator_name
