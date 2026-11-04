-- Reading spells: runs of finished books with no gap longer than
-- var('reading_break_days'). Long breaks (study, a slump) split the history,
-- so pace is measured while reading rather than averaged over the breaks.
-- Gaps are taken between distinct days, so two books finished the same day
-- always land in the same spell.
with days as (
    select d.date, count(*) as books
    from {{ ref('fact_reading') }} f
    join {{ ref('dim_item') }} i using (item_id)
    join {{ ref('dim_date') }} d using (date_id)
    where i.item_type = 'book'
    group by d.date
),
marked as (
    select
        date,
        books,
        case
            when date_diff('day', lag(date) over (order by date), date) <= {{ var('reading_break_days') }} then 0
            else 1
        end as starts_spell
    from days
),
numbered as (
    select date, books, sum(starts_spell) over (order by date) as spell_number from marked
)
select
    spell_number,
    min(date) as started_on,
    max(date) as ended_on,
    sum(books) as books,
    case when sum(books) > 1 then date_diff('day', min(date), max(date)) / (sum(books) - 1) end as days_per_book,
    case when sum(books) > 1 then sum(books) * 365.25 / greatest(date_diff('day', min(date), max(date)), 1) end as books_per_year,
    date_diff('day', max(date), current_date) <= {{ var('reading_break_days') }} as is_current
from numbered
group by spell_number
