select finish_year, finish_month, reads as books_read
from {{ ref('metric_reads_by_period') }}
where item_type = 'book'
