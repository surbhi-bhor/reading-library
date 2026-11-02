select item_id, creator_id, min(creator_order) as creator_order
from {{ ref('int_item_creators') }}
group by item_id, creator_id
