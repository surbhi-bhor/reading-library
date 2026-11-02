-- Share of reads that carry each topic. A book has several topics, so the
-- shares overlap; the denominator is reads with at least one real topic.
with topical as (
    select f.reading_id, t.topic_name
    from {{ ref('fact_reading') }} f
    join {{ ref('bridge_item_topic') }} b using (item_id)
    join {{ ref('dim_topic') }} t using (topic_id)
    where not t.is_generic
),

total as (select count(distinct reading_id) as n from topical)

select topic_name, count(distinct reading_id) as reads, count(distinct reading_id) / any_value(total.n) as share
from topical, total
group by topic_name
