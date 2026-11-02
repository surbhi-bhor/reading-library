-- Numbers must never disagree between pages: each published total is
-- checked against the fact table and against the other metrics.
with fact as (
    select count(*) as reads, sum(i.page_count) as pages
    from {{ ref('fact_reading') }} f join {{ ref('dim_item') }} i using (item_id)
    where i.item_type = 'book'
),
items as (select coalesce(sum(items_read), 0) as n from {{ ref('metric_items_read') }} where item_type = 'book'),
dated as (select coalesce(sum(books_read), 0) as n from {{ ref('metric_books_by_period') }}),
undated as (select coalesce(sum(undated_reads), 0) as n from {{ ref('metric_undated_reads') }} where item_type = 'book'),
pages as (select coalesce(sum(pages_read), 0) as n from {{ ref('metric_pages_read') }})

select 'items_read vs fact' as check_name from items, fact where items.n <> fact.reads
union all
select 'dated + undated vs items_read' from items, dated, undated where dated.n + undated.n <> items.n
union all
select 'pages_read vs fact' from pages, fact where pages.n <> coalesce(fact.pages, 0)
