select
    current_timestamp as built_at,
    (select max(extracted_at) from {{ ref('stg_hardcover__books') }}) as hardcover_extracted_at,
    (select count(*) from {{ ref('dim_item') }})::integer as items_on_shelves
