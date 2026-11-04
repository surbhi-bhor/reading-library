with books as (
    select distinct f.item_id, i.page_count, i.first_published_year, i.genre
    from {{ ref('fact_reading') }} f
    join {{ ref('dim_item') }} i using (item_id)
    where i.item_type = 'book'
)
,
buckets as (
    select * from (values
        (1, '1-100', 1, 100), (2, '101-200', 101, 200), (3, '201-300', 201, 300), (4, '301-400', 301, 400),
        (5, '401-500', 401, 500), (6, '501-600', 501, 600), (7, '601-1000', 601, 1000), (8, '1000+', 1001, 1000000)
    ) as t(bucket_order, bucket, low, high)
)
-- Finished books per page-count band; every band appears, empty ones with 0.
select k.bucket_order, k.bucket, count(b.item_id) as books
from buckets k
left join books b on b.page_count between k.low and k.high
group by k.bucket_order, k.bucket
