with by_type as (
    select i.item_type, sum(f.reading_minutes) as reading_minutes
    from {{ ref('fact_reading') }} f join {{ ref('dim_item') }} i using (item_id)
    group by i.item_type
)

select item_type, reading_minutes, reading_minutes / sum(reading_minutes) over () as share
from by_type
