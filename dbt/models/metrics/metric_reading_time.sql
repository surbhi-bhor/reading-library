select i.item_type, d.year as finish_year, sum(f.reading_minutes) as reading_minutes
from {{ ref('fact_reading') }} f
join {{ ref('dim_item') }} i using (item_id)
left join {{ ref('dim_date') }} d using (date_id)
group by i.item_type, d.year
