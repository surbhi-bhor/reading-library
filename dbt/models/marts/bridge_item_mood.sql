-- Grain: one row per item and mood tag Hardcover readers gave it.
select distinct i.item_id, trim(m.mood) as mood
from {{ ref('stg_hardcover__books') }} as b
join {{ ref('dim_item') }} as i on i.item_id = 'book:' || b.hardcover_id
cross join unnest(b.moods) as m(mood)
where trim(m.mood) <> ''
