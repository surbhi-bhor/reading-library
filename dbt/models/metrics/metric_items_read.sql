-- items_read counts finished reads (a re-read counts again);
-- distinct_items counts the books themselves, one per spine.
select i.item_type, count(*) as items_read, count(distinct f.item_id) as distinct_items
from {{ ref('fact_reading') }} f join {{ ref('dim_item') }} i using (item_id)
group by i.item_type
