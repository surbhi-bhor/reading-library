-- Open Library subjects as topics. Format, audience, marketing and library
-- tags ("Fiction", "New York Times bestseller", BISAC "..., general") are on
-- most books and say nothing about what a book is about: flagged generic.
-- List and patterns copied from the main project's dim_book_subject.sql.
select
    md5(lower(subject_name)) as topic_id,
    min(subject_name) as topic_name,
    (
        lower(min(subject_name)) in (
            'fiction', 'fiction, general', 'general', 'literature', 'novel', 'novels',
            'juvenile fiction', 'juvenile literature', 'children''s fiction',
            'new york times bestseller', 'new york times reviewed', 'bestsellers',
            'romans, nouvelles', 'romans, nouvelles, etc.', 'roman', 'romans',
            'american literature', 'english literature', 'english fiction',
            'american fiction', 'fiction in english', 'literary', 'literary fiction',
            'fiction, literary', 'adult', 'contemporary', 'classic literature',
            'translations into english',
            'british and irish fiction (fictional works by one author)',
            'american fiction (fictional works by one author)',
            'english fiction (fictional works by one author)'
        )
        or regexp_matches(lower(min(subject_name)), '^(collection:|nyt:|reading level|award|accessible book|protected daisy|in library|lending library|large type|popular print|open library)')
        or regexp_matches(lower(min(subject_name)), ', general$')
    ) as is_generic
from {{ ref('stg_openlibrary__subjects') }}
group by md5(lower(subject_name))
