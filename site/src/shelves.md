---
title: Shelves
---

```js
import {Bookcase, Shelf} from "./components/shelf.js";

const shelf = await FileAttachment("data/shelf.json").json();
const metrics = await FileAttachment("data/metrics.json").json();

const read = shelf.filter((d) => d.shelf_status === "read");
const favourites = read.filter((d) => d.rating_10 === 10);
const undated = read.filter((d) => d.finish_dates.length === 0);
// A re-read stands on the shelf of every year it was finished.
const years = metrics.metric_books_by_period.map((d) => d.finish_year);
// Each plate counts the spines on its own shelf.
const byYear = [...new Set(years)].sort((a, b) => b - a).map((year) => {
  const books = read.filter((d) => d.finish_dates.some((f) => f.startsWith(String(year))));
  return {year, count: books.length, books};
});

function section(title, count, note, books, label) {
  return html`<section>
    <div class="section-head"><h2>${title}</h2><span class="plate">${count}</span>${note ? html`<p>${note}</p>` : ""}</div>
    ${Bookcase(Shelf(books, {label}))}
  </section>`;
}
```

<header class="page-head">
  <h1>The shelves</h1>
  <p>The same books, sorted the way I think about them: the ones I loved, then each year I read them in.</p>
</header>

```js
if (favourites.length) display(section("Five stars", favourites.length, "Books I would hand to anyone.", favourites, "Five-star books"));
for (const {year, count, books} of byYear) display(section(String(year), count, null, books, `Books finished in ${year}`));
if (undated.length) display(section("Undated", undated.length, "Read before I kept dates.", undated, "Books without a finish date"));
```
