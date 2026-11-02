-- reads counts finished reads; books counts distinct books (spines on that genre shelf).
select i.genre, count(*) as reads, count(distinct f.item_id) as books, count(*) / sum(count(*)) over () as share
from {{ ref('fact_reading') }} f join {{ ref('dim_item') }} i using (item_id)
group by i.genre
