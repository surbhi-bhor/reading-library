-- One row per recommended book that checked out as a real Open Library work,
-- with the visitor's name and note (dropped by the extract if they held a link) (data/raw/recommendations.json,
-- written by extract/recommendations.py from the Supabase table). Columns are listed so an
-- empty file (before the first approval) still has a schema.
select
    rec_id,
    title,
    author,
    ol_key,
    cover_id,
    recommended_by,
    note,
    recommended_on,
    extracted_at::timestamptz as extracted_at
from read_json('../data/raw/recommendations.json', format = 'array', columns = {
    'rec_id': 'VARCHAR', 'title': 'VARCHAR', 'author': 'VARCHAR', 'ol_key': 'VARCHAR', 'cover_id': 'INTEGER',
    'recommended_by': 'VARCHAR', 'note': 'VARCHAR', 'recommended_on': 'DATE', 'extracted_at': 'VARCHAR'
})
