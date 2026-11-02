-- One row per finished read. A read book with no dates still counts once,
-- undated, so half the library is not silently dropped.
with read_books as (
    select hardcover_id, finished_dates
    from {{ ref('stg_hardcover__books') }}
    where shelf_status = 'read'
)

select hardcover_id, cast(d.i as integer) as read_number, finished_dates[d.i]::date as finished_at
from read_books, range(1, len(finished_dates) + 1) as d(i)

union all

select hardcover_id, 1 as read_number, null::date as finished_at
from read_books
where len(finished_dates) = 0
