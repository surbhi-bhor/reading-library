-- Essays and articles for the site's reading table, from Raindrop.
-- Only rows with a real link are published, so a half-typed row never shows.
select read_id, title, author, source, url, topic, note, added_on, status
from {{ ref('stg_raindrop__articles') }}
where url like 'https://%'
