select d.year as finish_year, d.month as finish_month, count(*) as books_read
from {{ ref('fact_reading') }} f
join {{ ref('dim_item') }} i using (item_id)
join {{ ref('dim_date') }} d using (date_id)
where i.item_type = 'book'
group by d.year, d.month
