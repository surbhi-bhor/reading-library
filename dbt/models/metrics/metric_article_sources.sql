-- Where the articles I read come from (Substack, Medium, ...), by publication.
select coalesce(s.source_name, 'Unknown') as source_name, count(*) as articles, count(*) / sum(count(*)) over () as share
from {{ ref('fact_reading') }} f
join {{ ref('dim_item') }} i using (item_id)
left join {{ ref('dim_source') }} s using (source_id)
where i.item_type = 'article'
group by 1
