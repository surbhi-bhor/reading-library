select creator_id, min(creator_name) as creator_name
from {{ ref('int_item_creators') }}
group by creator_id
