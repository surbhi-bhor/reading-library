-- The spec's privacy rule: only allow-listed columns may reach the site.
-- Every column in the metrics and publish schemas must be in the seed.
-- The depends_on lines make dbt run this after every published table is
-- built; without them it ran first and, on a fresh warehouse, checked nothing.
-- depends_on: {{ ref('metric_items_read') }}
-- depends_on: {{ ref('metric_books_by_period') }}
-- depends_on: {{ ref('metric_pages_read') }}
-- depends_on: {{ ref('metric_reading_time') }}
-- depends_on: {{ ref('metric_avg_rating') }}
-- depends_on: {{ ref('metric_top_creators') }}
-- depends_on: {{ ref('metric_topic_mix') }}
-- depends_on: {{ ref('metric_long_form_share') }}
-- depends_on: {{ ref('metric_undated_reads') }}
-- depends_on: {{ ref('pub_shelf') }}
-- depends_on: {{ ref('pub_build_info') }}
select c.table_schema, c.table_name, c.column_name
from information_schema.columns as c
left join {{ ref('allowed_published_columns') }} as a
    on a.table_name = c.table_name and a.column_name = c.column_name
where c.table_schema in ('metrics', 'publish')
  and a.column_name is null
