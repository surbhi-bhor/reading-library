select i.item_type, count(*) as items_read
from {{ ref('fact_reading') }} f join {{ ref('dim_item') }} i using (item_id)
group by i.item_type
