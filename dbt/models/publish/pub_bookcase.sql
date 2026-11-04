-- What stands on the main bookcase, in shelf order: books being read first,
-- then finished books and articles together, newest finish first, undated last.
-- Want-to-read books have their own shelf and stay out.
select
    s.*,
    -- An article's topic is its first Raindrop tag.
    r.topic,
    row_number() over (
        order by s.shelf_status = 'reading' desc, s.last_finished desc nulls last, s.title, s.item_id
    ) as shelf_position
from {{ ref('pub_shelf') }} as s
left join {{ ref('pub_reading_list') }} as r on r.read_id = s.item_id
where s.shelf_status in ('reading', 'read')
