-- Grain: one row per finished read of one item. Only items on the read
-- shelf count, so a book moved back to want-to-read never reaches a metric.
-- An article is read once, on the day it was saved to Raindrop.
select
    md5(i.item_id || '#' || r.read_number::varchar) as reading_id,
    i.item_id,
    cast(strftime(r.finished_at, '%Y%m%d') as integer) as date_id,
    i.rating_10,
    'read' as status,
    i.page_count * cast({{ var('minutes_per_page') }} as double) as reading_minutes
from {{ ref('stg_hardcover__reads') }} as r
join {{ ref('dim_item') }} as i
    on i.item_id = 'book:' || r.hardcover_id and i.shelf_status = 'read'

union all

select
    md5(i.item_id || '#1') as reading_id,
    i.item_id,
    cast(strftime(a.added_on, '%Y%m%d') as integer) as date_id,
    i.rating_10,
    'read' as status,
    null as reading_minutes
from {{ ref('stg_raindrop__articles') }} as a
join {{ ref('dim_item') }} as i
    on i.item_id = a.read_id and i.item_type = 'article' and i.shelf_status = 'read'
