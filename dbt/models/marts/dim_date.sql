-- Calendar from Jan 1 of the earliest finish (book or article) year to Dec 31 of the later of
-- this year and the latest finish year.
with bounds as (
    select
        make_date(coalesce(min(year(finished_at)), year(current_date)), 1, 1) as first_day,
        make_date(greatest(coalesce(max(year(finished_at)), 0), year(current_date)), 12, 31) as last_day
    from (
        select finished_at from {{ ref('stg_hardcover__reads') }}
        union all
        select added_on from {{ ref('stg_raindrop__articles') }}
    )
),

days as (
    select cast(d.generate_series as date) as date
    from bounds, generate_series(first_day::timestamp, last_day::timestamp, interval 1 day) as d
)

select
    cast(strftime(date, '%Y%m%d') as integer) as date_id,
    date,
    year(date) as year,
    month(date) as month,
    monthname(date) as month_name,
    case when month(date) in (12, 1, 2) then 'winter'
         when month(date) in (3, 4, 5) then 'spring'
         when month(date) in (6, 7, 8) then 'summer'
         else 'autumn' end as season,
    dayname(date) as weekday
from days
