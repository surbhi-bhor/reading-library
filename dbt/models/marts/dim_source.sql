-- Publishers of books (Open Library) and publications articles come from (Raindrop).
select distinct md5(lower(ol.publisher)) as source_id, ol.publisher as source_name, 'publisher' as source_kind
from {{ ref('stg_openlibrary__books') }} as ol
where ol.publisher is not null
qualify row_number() over (partition by md5(lower(ol.publisher)) order by ol.publisher) = 1

union all

select distinct md5(lower(a.source)) as source_id, a.source as source_name, 'publication' as source_kind
from {{ ref('stg_raindrop__articles') }} as a
where a.source is not null and md5(lower(a.source)) not in (
    select md5(lower(publisher)) from {{ ref('stg_openlibrary__books') }} where publisher is not null
)
qualify row_number() over (partition by md5(lower(a.source)) order by a.source) = 1
