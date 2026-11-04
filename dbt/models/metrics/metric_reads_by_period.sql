-- Finished reads per month, books and articles alike. The one definition of
-- dated reads per period; metric_books_by_period is its book rows.
select i.item_type, d.year as finish_year, d.month as finish_month, count(*) as reads
from {{ ref('fact_reading') }} f
join {{ ref('dim_item') }} i using (item_id)
join {{ ref('dim_date') }} d using (date_id)
group by i.item_type, d.year, d.month
