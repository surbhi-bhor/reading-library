select distinct 'book:' || s.hardcover_id as item_id, md5(lower(s.subject_name)) as topic_id
from {{ ref('stg_openlibrary__subjects') }} as s
join {{ ref('dim_item') }} as i on i.item_id = 'book:' || s.hardcover_id
