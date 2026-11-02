select d.year as finish_year, sum(i.page_count) as pages_read
from {{ ref('fact_reading') }} f
join {{ ref('dim_item') }} i using (item_id)
left join {{ ref('dim_date') }} d using (date_id)
where i.item_type = 'book'
group by d.year
