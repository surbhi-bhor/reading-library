---
title: Stats
---

```js
import {AuthorList, ledgerFigures, outOfFive} from "./components/catalogue.js";
import {openBook} from "./components/bookPanel.js";
import {Figures} from "./components/ticker.js";
const metrics = await FileAttachment("data/metrics.json").json();
const shelf = await FileAttachment("data/shelf.json").json();
const f = ledgerFigures(metrics);
const nf = new Intl.NumberFormat("en-GB");
const one = new Intl.NumberFormat("en-GB", {maximumFractionDigits: 1});

// One look for every chart: rust for books, burgundy for articles, on the green wall.
const ink = "var(--color-ivory-dim)";
const gold = "var(--antique-gold)"; // rust: books
const burgundy = "var(--burgundy-chart)"; // articles, the second colour
// Redrawn at the card's real width, so tick labels stay readable on a phone.
const chart = (options) => resize((width) => Plot.plot({
  width, marginLeft: 0, marginBottom: 36, height: 240,
  style: {background: "transparent", color: ink, fontFamily: "var(--font-body)", fontSize: "13px", overflow: "visible"},
  ...(typeof options === "function" ? options(width) : options)
}));
// A stat card: what it measures, the finding in one sentence, the chart, and its numbers.
function card(kicker, finding, note, body, rows, columns, {wide = false} = {}) {
  const table = rows && html`<details><summary>Show the numbers</summary><table class="data-table"><thead><tr>${columns.map(([, h]) => html`<th scope="col">${h}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr>${columns.map(([k]) => html`<td>${r[k]}</td>`)}</tr>`)}</tbody></table></details>`;
  return html`<figure class="chart stat-card${wide ? " is-wide" : ""}">
    <figcaption><p class="stat-kicker">${kicker}</p><h3 class="stat-finding">${finding}</h3>${note ? html`<p>${note}</p>` : ""}</figcaption>
    ${body}${table ?? ""}
  </figure>`;
}

const pace = metrics.metric_reading_pace[0] ?? {};
// Reading spells, oldest first. One-book spells have no pace and stay out of the summary sentence.
const spells = [...(metrics.metric_reading_spells ?? [])].sort((a, b) => a.spell_number - b.spell_number);
const current = spells.find((s) => s.is_current);
const pastSpells = spells.filter((s) => !s.is_current && s.books > 1);
const weeks = (days) => { const w = Math.max(1, Math.round(days / 7)); return w === 1 ? "week" : `${w} weeks`; };
const monthYear = (d) => new Date(d).toLocaleDateString("en-GB", {month: "long", year: "numeric"});
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Books per month. Articles stay out of the timelines: each is dated the day it
// was saved, so a week of saving would read as a record month.
const calendar = metrics.metric_books_by_period.map((d) => ({year: d.finish_year, month: d.finish_month, books: d.books_read}));
// The month with the most books; on a tie, the most recent one.
const busiest = d3.greatest(calendar, (a, b) => a.books - b.books || (a.year * 12 + a.month) - (b.year * 12 + b.month));
const years = d3.range(d3.max(calendar, (d) => d.year), d3.min(calendar, (d) => d.year) - 1, -1);
const byYear = d3.rollups(calendar, (v) => d3.sum(v, (d) => d.books), (d) => d.year).map(([year, books]) => ({year, books})).sort((a, b) => a.year - b.year);
const bestYear = d3.greatest(byYear, (d) => d.books);
const articlesRead = metrics.metric_items_read.find((d) => d.item_type === "article")?.distinct_items ?? 0;
const sources = [...metrics.metric_article_sources].sort((a, b) => b.articles - a.articles || a.source_name.localeCompare(b.source_name));
const split = [...metrics.metric_fiction_split].sort((a, b) => b.books - a.books);
// Articles have their own card; genres are the books' shelves.
const genres = [...metrics.metric_genre_mix].filter((d) => d.genre !== "Articles").sort((a, b) => b.books - a.books || a.genre.localeCompare(b.genre));
const moods = [...metrics.metric_mood_mix].sort((a, b) => b.books - a.books || a.mood.localeCompare(b.mood)).slice(0, 8);
const spread = [...metrics.metric_rating_spread].map((d) => ({stars: d.rating_10 / 2, reads: d.reads})).sort((a, b) => a.stars - b.stars);
const topStars = d3.greatest(spread, (d) => d.reads);
const bands = [...metrics.metric_page_buckets].sort((a, b) => a.bucket_order - b.bucket_order);
const topBand = d3.greatest(bands, (d) => d.books);
const authors = [...metrics.metric_top_creators].filter((d) => d.items_read >= 2).sort((a, b) => a.rank - b.rank).slice(0, 6);
const genreRatings = metrics.metric_avg_rating.filter((d) => d.dimension === "genre")
  .map((d) => ({genre: d.dimension_value, stars: d.avg_rating_10 / 2, rated: d.rated_reads})).sort((a, b) => b.stars - a.stars);
const pubYears = [...metrics.metric_publication_years].sort((a, b) => a.first_published_year - b.first_published_year);
const pubTotal = d3.sum(pubYears, (d) => d.books);
const thisDecade = d3.sum(pubYears.filter((d) => d.first_published_year >= new Date().getFullYear() - 10), (d) => d.books);
const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const say = (n) => words[n] ?? nf.format(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
```

<header class="page-head">
  <h1>Reading in numbers</h1>
  
</header>

```js
const ratingNumber = Number.parseFloat(f.rating);
display(Figures([
  {value: f.books, label: "books finished"},
  {value: articlesRead, label: "articles read"},
  {value: f.pages, label: "pages"},
  {value: pace.authors_read ?? 0, label: "authors"},
  Number.isFinite(ratingNumber) ? {value: ratingNumber, label: "average stars", decimals: 1} : {value: f.rating, label: "average stars"},
  {value: pace.last_12_months_books ?? 0, label: "books this past year"}
], {label: "Reading totals"}));
```

```js
display(html`<div class="charts stat-grid">
${card("Reading pace",
  current ? `Reading now: a book every ${weeks(pace.current_days_per_book)}` : `Between spells: the last book was ${monthYear(pace.last_finished)}`,
  "Long breaks between books are left out, so this is my pace while reading.",
  html`<dl class="pace-trio">
    <div><dd>${nf.format(pace.last_12_months_books)}</dd><dt>books in the last 12 months</dt></div>
    <div><dd>${one.format(current?.books_per_year ?? 365.25 / pace.active_days_per_book)}</dd><dt>books a year ${current ? "right now" : "while reading"}</dt></div>
  </dl>`,
  spells.map((s) => ({...s, pace: s.books_per_year ? one.format(s.books_per_year) : "", status: s.is_current ? "Now" : ""})),
  [["started_on", "From"], ["ended_on", "To"], ["books", "Books"], ["pace", "A year"], ["status", ""]])}
${card("Books by year", `${bestYear.year} is my biggest year so far, with ${say(bestYear.books)} books`, "",
  chart({
    x: {type: "band", label: null, tickFormat: "d"},
    y: {label: null, grid: true, tickFormat: "d"},
    marginLeft: 24,
    marks: [
      Plot.barY(byYear, {x: "year", y: "books", fill: gold, rx: 3, insetLeft: 4, insetRight: 4, tip: {format: {x: (d) => String(d)}}}),
      Plot.text(byYear, {x: "year", y: "books", text: "books", dy: -8, fill: "var(--cream)", fontWeight: 600}),
      Plot.ruleY([0], {stroke: ink})
    ]
  }), byYear, [["year", "Year"], ["books", "Books"]])}
${card("Articles", articlesRead ? `${cap(say(articlesRead))} ${articlesRead === 1 ? "article" : "articles"}, ${sources.length > 1 ? "most" : "all"} from ${sources[0]?.source_name}` : "No articles saved yet", "",
  chart({
    x: {label: null, grid: true, tickFormat: "d", ticks: Math.min(5, d3.max(sources, (d) => d.articles) ?? 1)},
    y: {label: null, domain: sources.map((d) => d.source_name)},
    marginLeft: 110, height: 40 * Math.max(sources.length, 1) + 60,
    marks: [
      Plot.barX(sources, {y: "source_name", x: "articles", fill: burgundy, rx: 3, insetTop: 5, insetBottom: 5, tip: true}),
      Plot.text(sources, {y: "source_name", x: "articles", text: "articles", dx: 10, textAnchor: "start", fill: "var(--cream)"}),
      Plot.ruleX([0], {stroke: ink})
    ]
  }), sources.map((d) => ({...d, pct: `${Math.round(d.share * 100)}%`})), [["source_name", "Published on"], ["articles", "Articles"], ["pct", "Share"]])}
${card("Fiction and non-fiction", `Mostly ${split[0]?.kind.toLowerCase()}: ${Math.round((split[0]?.share ?? 0) * 100)}% of what I finish`, "",
  chart({
    height: 84, marginBottom: 8,
    x: {axis: null}, y: {axis: null},
    color: {domain: split.map((d) => d.kind), range: [gold, burgundy, "var(--line-strong)"], legend: true},
    marks: [
      Plot.barX(split, Plot.stackX({x: "books", fill: "kind", stroke: "var(--bg)", strokeWidth: 2, rx: 3, tip: true})),
      Plot.text(split, Plot.stackX({x: "books", text: (d) => `${Math.round(d.share * 100)}%`, fill: "var(--emerald-ink)", fontWeight: 700}))
    ]
  }), split.map((d) => ({...d, pct: `${Math.round(d.share * 100)}%`})), [["kind", "Kind"], ["books", "Books"], ["pct", "Share"]])}
${card("Genres", `${genres[0].genre} leads, with ${say(genres[0].books)} books`, "",
  chart({
    x: {label: null, grid: true, tickFormat: "d"},
    y: {label: null, domain: genres.map((d) => d.genre)},
    marginLeft: 140, height: 34 * genres.length + 30,
    marks: [
      Plot.barX(genres, {y: "genre", x: "books", fill: gold, rx: 3, insetTop: 5, insetBottom: 5, tip: true}),
      Plot.text(genres, {y: "genre", x: "books", text: "books", dx: 10, textAnchor: "start", fill: "var(--cream)"}),
      Plot.ruleX([0], {stroke: ink})
    ]
  }), genres, [["genre", "Genre"], ["books", "Books"]])}
${card("Moods", `${cap(moods[0]?.mood ?? "")} is the most common mood`, "Moods other readers gave these books. A book can have several.",
  chart({
    x: {label: null, grid: true, tickFormat: "d"},
    y: {label: null, domain: moods.map((d) => d.mood), tickFormat: cap},
    marginLeft: 110, height: 30 * moods.length + 30,
    marks: [
      Plot.barX(moods, {y: "mood", x: "books", fill: gold, rx: 3, insetTop: 5, insetBottom: 5, tip: true}),
      Plot.text(moods, {y: "mood", x: "books", text: "books", dx: 10, textAnchor: "start", fill: "var(--cream)"}),
      Plot.ruleX([0], {stroke: ink})
    ]
  }), moods.map((d) => ({...d, pct: `${Math.round(d.share * 100)}%`})), [["mood", "Mood"], ["books", "Books"], ["pct", "Of tagged books"]])}
${card("How I rate", `${topStars.stars === 5 ? "Five stars" : `${topStars.stars} stars`} more often than any other`, `Average ${f.rating}.`,
  chart({
    x: {type: "band", label: "Stars", domain: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]},
    y: {label: null, grid: true, tickFormat: "d"},
    marginLeft: 24,
    marks: [
      Plot.barY(spread, {x: "stars", y: "reads", fill: gold, rx: 3, insetLeft: 2, insetRight: 2, tip: true}),
      Plot.ruleY([0], {stroke: ink})
    ]
  }), spread, [["stars", "Stars"], ["reads", "Books"]])}
${card("Length", `Most run ${topBand.bucket.replace("-", " to ")} pages`, `The average finished book has ${nf.format(Math.round(pace.avg_page_count))} pages.`,
  chart((width) => {
    // Each band labelled by its top page count ("101-200" reads "200"), shortened to "1k" on a phone, so labels never collide.
    const top = (b) => (b.endsWith("+") ? b : b.split("-")[1]);
    const short = (t) => (width < 520 ? t.replace("1000", "1k") : t);
    return {
      x: {type: "band", label: "Pages, up to", domain: bands.map((d) => d.bucket), tickFormat: (b) => short(top(b))},
      y: {label: null, grid: true, tickFormat: "d"},
      marginLeft: 24,
      marks: [
        Plot.barY(bands, {x: "bucket", y: "books", fill: gold, rx: 3, insetLeft: 3, insetRight: 3, tip: true}),
        Plot.ruleY([0], {stroke: ink})
      ]
    };
  }), bands, [["bucket", "Pages"], ["books", "Books"]])}
${card("Authors I return to", authors.length ? `${authors[0].creator_name}, ${say(authors[0].items_read)} books and counting` : "No author twice yet", "Open one to see their books.",
  AuthorList(metrics, shelf, {open: openBook}))}
${card("Ratings by genre", `${genreRatings[0].genre} rates highest, at ${genreRatings[0].stars.toFixed(1)} stars`, "",
  chart({
    x: {label: null, domain: [0, 5], grid: true},
    y: {label: null, domain: genreRatings.map((d) => d.genre)},
    marginLeft: 140, marginRight: 80, height: 34 * genreRatings.length + 30,
    marks: [
      Plot.ruleY(genreRatings, {y: "genre", x1: 0, x2: "stars", stroke: ink, strokeOpacity: 0.35}),
      Plot.dot(genreRatings, {y: "genre", x: "stars", r: 6, fill: gold, stroke: "var(--color-wall)", strokeWidth: 2, tip: true}),
      Plot.text(genreRatings, {y: "genre", x: "stars", text: (d) => `${d.stars.toFixed(1)} from ${d.rated}`, dx: 12, textAnchor: "start", fill: ink})
    ]
  }), genreRatings.map((d) => ({...d, avg: d.stars.toFixed(1)})), [["genre", "Genre"], ["avg", "Average stars"], ["rated", "Rated books"]])}
${card("When they were written", `${Math.round((thisDecade / pubTotal) * 100)}% were first published in the last ten years`, "",
  chart({
    x: {label: null, tickFormat: "d", grid: false},
    y: {label: null, grid: true, tickFormat: "d"},
    marginLeft: 24,
    marks: [
      Plot.rectY(pubYears, {x1: (d) => d.first_published_year - 0.4, x2: (d) => d.first_published_year + 0.4, y: "books", fill: gold, title: (d) => `${d.first_published_year}: ${d.books} ${d.books === 1 ? "book" : "books"}`, tip: true}),
      Plot.ruleY([0], {stroke: ink})
    ]
  }), pubYears, [["first_published_year", "Year"], ["books", "Books"]])}
${card("The reading calendar", `Busiest month: ${monthLong[busiest.month - 1]} ${busiest.year}, with ${say(busiest.books)} ${busiest.books === 1 ? "book" : "books"}`, "Each dot is a month; bigger dots mean more books.",
  chart((width) => ({
    height: 42 * years.length + 50,
    marginLeft: 46,
    x: {type: "band", domain: d3.range(1, 13), label: null, tickFormat: (m) => (width >= 520 ? monthNames[m - 1] : monthNames[m - 1][0])},
    y: {type: "band", domain: years, label: null, tickFormat: "d"},
    r: {range: [0, 13]},
    marks: [
      Plot.gridY({stroke: ink, strokeOpacity: 0.12}),
      Plot.dot(calendar, {x: "month", y: "year", r: "books", fill: gold, title: (d) => `${monthLong[d.month - 1]} ${d.year}: ${d.books} ${d.books === 1 ? "book" : "books"}`, tip: true}),
      Plot.text(calendar.filter((d) => d.books > 1), {x: "month", y: "year", text: "books", fill: "var(--emerald-ink)", fontWeight: 700})
    ]
  })), calendar.map((d) => ({...d, label: `${monthNames[d.month - 1]} ${d.year}`})), [["label", "Month"], ["books", "Books"]], {wide: true})}
</div>`);
```

```js
// The tape deck in the corner of every room.
import {mountCassette} from "./components/cassette.js";
mountCassette();
```
