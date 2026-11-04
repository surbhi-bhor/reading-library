-- One row per article I have read, as saved to Raindrop (data/raw/raindrop_articles.json).
-- Read here rather than as a dbt source: the column list gives an empty file
-- (before the first article) a schema, and its braces clash with the source
-- template. Listing columns also means nothing unexpected is ever read in.
select
    read_id,
    title,
    author,
    source,
    url,
    topic,
    note,
    added_on,
    status,
    cover_url,
    extracted_at::timestamptz as extracted_at
from read_json('../data/raw/raindrop_articles.json', format = 'array', columns = {
    'read_id': 'VARCHAR', 'title': 'VARCHAR', 'author': 'VARCHAR', 'source': 'VARCHAR', 'url': 'VARCHAR',
    'topic': 'VARCHAR', 'note': 'VARCHAR', 'added_on': 'DATE', 'status': 'VARCHAR', 'cover_url': 'VARCHAR', 'extracted_at': 'VARCHAR'
})
