-- Raindrop and Supabase are read directly in staging, not as dbt sources, so
-- `dbt source freshness` does not see them. A failed fetch keeps the last good
-- rows, so this warns when either one has not been refreshed for 8 days.
-- An empty file has no rows to date and passes.
{{ config(severity = 'warn') }}

select 'raindrop' as extract, max(extracted_at) as last_extracted
from {{ ref('stg_raindrop__articles') }}
having max(extracted_at) < now() - interval 8 day

union all

select 'supabase', max(extracted_at)
from {{ ref('stg_supabase__recommendations') }}
having max(extracted_at) < now() - interval 8 day
