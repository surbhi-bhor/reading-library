-- How fast I read books: one row. Dated reads only, so undated books never
-- stretch or squeeze it. The lifetime span includes long breaks, so the site
-- leads with the current spell and the last 12 months instead (see
-- metric_reading_spells); the lifetime figures stay for context.
with dated as (
    select d.date
    from {{ ref('fact_reading') }} f
    join {{ ref('dim_item') }} i using (item_id)
    join {{ ref('dim_date') }} d using (date_id)
    where i.item_type = 'book'
),
span as (
    select
        count(*) as dated_reads,
        min(date) as first_finished,
        max(date) as last_finished,
        count(*) filter (where date > current_date - interval 12 month) as last_12_months_books
    from dated
),
spells as (
    -- Pace while reading: days spent inside spells over the gaps inside them.
    -- One-book spells have no gap to measure and stay out.
    select
        count(*) as reading_spells,
        sum(date_diff('day', started_on, ended_on)) / nullif(sum(books - 1), 0) as active_days_per_book
    from {{ ref('metric_reading_spells') }}
),
current_spell as (
    select started_on as current_spell_started, books as current_spell_books, days_per_book as current_days_per_book
    from {{ ref('metric_reading_spells') }}
    where is_current
),
authors as (
    select count(distinct b.creator_id) as authors_read
    from {{ ref('bridge_item_creator') }} b
    where b.item_id in (select item_id from {{ ref('fact_reading') }})
),
pages as (
    select avg(i.page_count) as avg_page_count
    from (select distinct item_id from {{ ref('fact_reading') }}) f join {{ ref('dim_item') }} i using (item_id)
    where i.page_count is not null
)
select
    s.dated_reads,
    s.first_finished,
    s.last_finished,
    case when s.dated_reads > 1 then date_diff('day', s.first_finished, s.last_finished) / (s.dated_reads - 1) end as days_per_book,
    case when s.dated_reads > 1 then s.dated_reads * 365.25 / greatest(date_diff('day', s.first_finished, s.last_finished), 1) end as books_per_year,
    s.last_12_months_books,
    sp.reading_spells,
    sp.active_days_per_book,
    c.current_spell_started,
    c.current_spell_books,
    c.current_days_per_book,
    {{ var('reading_break_days') }} as reading_break_days,
    a.authors_read,
    p.avg_page_count
from span s
cross join spells sp
left join current_spell c on true
cross join authors a
cross join pages p
