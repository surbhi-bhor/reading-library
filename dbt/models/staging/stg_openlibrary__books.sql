select
    hardcover_id::varchar as hardcover_id,
    ol_key,
    {{ latin_or_null('author_name') }} as author_name,
    first_publish_year::integer as first_publish_year,
    page_count::integer as page_count,
    case when cover_id is not null
        then 'https://covers.openlibrary.org/b/id/' || cover_id::varchar || '-L.jpg'
    end as cover_url,
    nullif(trim(publisher), '') as publisher,
    subjects,
    extracted_at::timestamptz as extracted_at
from {{ source('raw', 'openlibrary_books') }}
