-- How my ratings spread: rated finished reads per rating step (0 to 10).
select f.rating_10, count(*) as reads
from {{ ref('fact_reading') }} f
where f.rating_10 is not null
group by f.rating_10
