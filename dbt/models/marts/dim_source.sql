select distinct md5(lower(ol.publisher)) as source_id, ol.publisher as source_name, 'publisher' as source_kind
from {{ ref('stg_openlibrary__books') }} as ol
where ol.publisher is not null
qualify row_number() over (partition by md5(lower(ol.publisher)) order by ol.publisher) = 1
