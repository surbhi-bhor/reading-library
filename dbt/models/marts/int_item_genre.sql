-- One genre shelf per book, fully automatic. Open Library subjects are too
-- noisy to filter by, so each book is matched against genre_rules using its
-- subjects, its Hardcover genre tags and its title together. A book nothing
-- matches takes the most common genre of the author's other books, then Fiction.
with subjects as (
    select hardcover_id, string_agg(subject_name, ' | ') as subject_text
    from {{ ref('stg_openlibrary__subjects') }}
    group by hardcover_id
),

books as (
    select
        b.hardcover_id,
        b.author,
        lower(concat_ws(' | ', s.subject_text, array_to_string(b.genres, ' | '), b.title)) as signal_text
    from {{ ref('stg_hardcover__books') }} as b
    left join subjects as s using (hardcover_id)
),

ruled as (
    select b.hardcover_id, r.genre
    from books as b
    join {{ ref('genre_rules') }} as r on regexp_matches(b.signal_text, r.pattern)
    qualify row_number() over (partition by b.hardcover_id order by r.priority) = 1
),

author_genre as (
    select b.author, mode(r.genre) as genre
    from books as b
    join ruled as r using (hardcover_id)
    where b.author is not null
    group by b.author
)

select b.hardcover_id, coalesce(r.genre, a.genre, 'Fiction') as genre
from books as b
left join ruled as r using (hardcover_id)
left join author_genre as a on a.author = b.author
