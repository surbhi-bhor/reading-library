with unnested as (
    select hardcover_id, trim(unnest(subjects)) as subject_name
    from {{ ref('stg_openlibrary__books') }}
)

select distinct hardcover_id, subject_name
from unnested
where subject_name is not null and subject_name <> ''
  -- English tags only: Open Library mixes in French, Spanish, German and Polish catalogue tags.
  and not {{ is_non_english_subject('subject_name') }}
