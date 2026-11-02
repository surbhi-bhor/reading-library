---
title: Stats
---

```js
import {ledgerFigures, outOfFive} from "./components/catalogue.js";
const metrics = await FileAttachment("data/metrics.json").json();
const f = ledgerFigures(metrics);
const nf = new Intl.NumberFormat("en-GB");

// One look for every chart: a single brass series on the green wall.
const ink = "var(--color-ivory-dim)";
const brass = "var(--color-brass)";
// Redrawn at the column's real width, so tick labels stay readable on a phone.
const chart = (options) => resize((width) => Plot.plot({
  width, marginLeft: 0, marginBottom: 36, height: 260,
  style: {background: "transparent", color: ink, fontFamily: "var(--font-body)", fontSize: "13px", overflow: "visible"},
  ...(typeof options === "function" ? options(width) : options)
}));
// Narrow screens: month initials, with the year under each January (and the first month).
const monthTick = (width) => (k) => {
  const d = months.find((m) => m.key === k);
  if (!d) return "";
  if (width >= 520) return d.label.replace(" ", "\n");
  const initial = d.label[0];
  // The first month gets a year too, unless January follows right after and would collide with it.
  const firstNeedsYear = d === months[0] && months[1]?.month.getUTCMonth() !== 0;
  return d.month.getUTCMonth() === 0 || firstNeedsYear ? `${initial}\n${d.month.getUTCFullYear()}` : initial;
};

function figure(title, note, plot, rows, columns) {
  const table = html`<table class="data-table"><thead><tr>${columns.map(([, h]) => html`<th scope="col">${h}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr>${columns.map(([k]) => html`<td>${r[k]}</td>`)}</tr>`)}</tbody></table>`;
  return html`<figure class="chart">
    <figcaption><h3>${title}</h3>${note ? html`<p>${note}</p>` : ""}</figcaption>
    ${plot}
    <details><summary>Show the numbers</summary>${table}</details>
  </figure>`;
}

// Every month between the first and last finish, so empty months show as gaps.
const dated = metrics.metric_books_by_period;
const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const months = [];
if (dated.length) {
  const first = Math.min(...dated.map((d) => d.finish_year * 12 + d.finish_month - 1));
  const last = Math.max(...dated.map((d) => d.finish_year * 12 + d.finish_month - 1));
  for (let i = first; i <= last; i++) {
    const y = Math.floor(i / 12), m = (i % 12) + 1;
    const hit = dated.find((d) => d.finish_year === y && d.finish_month === m);
    months.push({month: new Date(Date.UTC(y, m - 1, 1)), label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {month: "short", year: "numeric", timeZone: "UTC"}), books: hit?.books_read ?? 0, key: monthKey(y, m)});
  }
}
const genres = [...metrics.metric_genre_mix].sort((a, b) => b.reads - a.reads);
const genreRatings = metrics.metric_avg_rating.filter((d) => d.dimension === "genre")
  .map((d) => ({genre: d.dimension_value, stars: d.avg_rating_10 / 2, rated: d.rated_reads}))
  .sort((a, b) => b.stars - a.stars);
const spread = [...metrics.metric_rating_spread].map((d) => ({stars: d.rating_10 / 2, reads: d.reads})).sort((a, b) => a.stars - b.stars);
const pagesByYear = [...metrics.metric_pages_read]
  .map((d) => ({year: d.finish_year == null ? "Undated" : String(d.finish_year), pages: d.pages_read}))
  .sort((a, b) => (a.year === "Undated") - (b.year === "Undated") || b.year.localeCompare(a.year));
```

<header class="page-head">
  <h1>The numbers, plainly</h1>
  <p>The same figures as the rest of the library, drawn as ordinary charts. Every one comes from the metric tables in the warehouse, so nothing here can disagree with the shelves.</p>
</header>

```js
display(html`<dl class="tiles">
  <div><dt>Books finished</dt><dd>${nf.format(f.books)}</dd></div>
  <div><dt>Pages turned</dt><dd>${nf.format(f.pages)}</dd></div>
  <div><dt>Hours of reading</dt><dd>${nf.format(f.hours)}</dd></div>
  <div><dt>Average rating</dt><dd>${f.rating}</dd></div>
  <div><dt>Without a finish date</dt><dd>${nf.format(f.undated)}</dd></div>
</dl>`);
```

```js
display(html`<div class="charts">
${figure("Books finished per month", `Dated books only. ${f.undated} more have no finish date.`,
  chart((width) => ({
    x: {type: "band", label: null, tickFormat: monthTick(width)},
    y: {label: "Books", grid: true, ticks: Math.max(...months.map((d) => d.books), 1), tickFormat: "d", nice: true},
    marks: [
      Plot.barY(months, {x: "key", y: "books", fill: brass, rx: 3, insetLeft: 2, insetRight: 2, tip: {format: {x: false}, channels: {Month: "label"}}}),
      Plot.ruleY([0], {stroke: ink})
    ],
    marginLeft: 28
  })), months, [["label", "Month"], ["books", "Books"]])}
${figure("What I read", "Finished books per genre shelf.",
  chart({
    x: {label: "Books", grid: true, tickFormat: "d"},
    y: {label: null, domain: genres.map((d) => d.genre)},
    marginLeft: 130, marginRight: 40, height: 36 * genres.length + 40,
    marks: [
      Plot.barX(genres, {y: "genre", x: "reads", fill: brass, rx: 3, insetTop: 4, insetBottom: 4, tip: true}),
      Plot.text(genres, {y: "genre", x: "reads", text: (d) => `${Math.round(d.share * 100)}%`, dx: 6, textAnchor: "start", fill: ink}),
      Plot.ruleX([0], {stroke: ink})
    ]
  }), genres.map((d) => ({...d, pct: `${Math.round(d.share * 100)}%`})), [["genre", "Genre"], ["reads", "Books"], ["pct", "Share"]])}
${figure("How I rate", "Rated books by stars. Hardcover allows half stars.",
  chart({
    x: {type: "band", label: "Stars", domain: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]},
    y: {label: "Books", grid: true, tickFormat: "d"},
    marginLeft: 28,
    marks: [
      Plot.barY(spread, {x: "stars", y: "reads", fill: brass, rx: 3, insetLeft: 2, insetRight: 2, tip: true}),
      Plot.ruleY([0], {stroke: ink})
    ]
  }), spread, [["stars", "Stars"], ["reads", "Books"]])}
${figure("Ratings by genre", "Average stars, with how many rated books each average stands on.",
  chart({
    x: {label: "Average stars", domain: [0, 5], grid: true},
    y: {label: null, domain: genreRatings.map((d) => d.genre)},
    marginLeft: 130, marginRight: 90, height: 36 * genreRatings.length + 40,
    marks: [
      Plot.ruleY(genreRatings, {y: "genre", x1: 0, x2: "stars", stroke: ink, strokeOpacity: 0.35}),
      Plot.dot(genreRatings, {y: "genre", x: "stars", r: 6, fill: brass, stroke: "var(--color-wall)", strokeWidth: 2, tip: true}),
      Plot.text(genreRatings, {y: "genre", x: "stars", text: (d) => `${d.stars.toFixed(1)} from ${d.rated}`, dx: 12, textAnchor: "start", fill: ink})
    ]
  }), genreRatings.map((d) => ({...d, avg: d.stars.toFixed(1)})), [["genre", "Genre"], ["avg", "Average stars"], ["rated", "Rated books"]])}
${figure("Pages by year", "Books with a known page count. Undated books keep their own bar.",
  chart({
    x: {label: "Pages", grid: true},
    y: {label: null, domain: pagesByYear.map((d) => d.year)},
    marginLeft: 80, height: 40 * pagesByYear.length + 40,
    marks: [
      Plot.barX(pagesByYear, {y: "year", x: "pages", fill: brass, rx: 3, insetTop: 5, insetBottom: 5, tip: true}),
      Plot.ruleX([0], {stroke: ink})
    ]
  }), pagesByYear, [["year", "Year"], ["pages", "Pages"]])}
</div>`);
```
