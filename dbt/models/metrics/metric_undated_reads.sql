select i.item_type, count(*) as undated_reads
from {{ ref('fact_reading') }} f join {{ ref('dim_item') }} i using (item_id)
where f.date_id is null
group by i.item_type
