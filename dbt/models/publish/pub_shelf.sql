-- The only item table the site reads: one row per item on a shelf, books and articles.
with finishes as (
    select f.item_id, list(d.date order by d.date) as finish_dates, max(d.date) as last_finished
    from {{ ref('fact_reading') }} f join {{ ref('dim_date') }} d using (date_id)
    group by f.item_id
),

first_author as (
    select b.item_id, c.creator_name as author
    from {{ ref('bridge_item_creator') }} b join {{ ref('dim_creator') }} c using (creator_id)
    where b.creator_order = 1
),

topics as (
    select b.item_id, list(t.topic_name order by t.topic_name) as topics
    from {{ ref('bridge_item_topic') }} b join {{ ref('dim_topic') }} t using (topic_id)
    where not t.is_generic
    group by b.item_id
)

select
    i.item_id, i.item_type as kind, i.title,
    -- An article has no author on record; its publication stands in, as on a journal's spine.
    coalesce(a.author, case when i.item_type = 'article' then src.source_name end) as author,
    case when i.item_type = 'article' then src.source_name end as source, i.cover_or_image_url as cover_url, i.cover_hd_url, i.url, i.page_count,
    i.first_published_year, i.shelf_status, i.rating_10, i.genre, i.summary,
    coalesce(fi.finish_dates, []::date[]) as finish_dates, fi.last_finished,
    coalesce(t.topics, []::varchar[]) as topics
from {{ ref('dim_item') }} i
left join first_author a using (item_id)
left join finishes fi using (item_id)
left join topics t using (item_id)
left join {{ ref('dim_source') }} src using (source_id)
