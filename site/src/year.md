---
title: Year in review
---

```js
import {Bookcase, Shelf} from "./components/shelf.js";
import {CheckoutCard, outOfFive} from "./components/catalogue.js";

const shelf = await FileAttachment("data/shelf.json").json();
const metrics = await FileAttachment("data/metrics.json").json();
const years = [...new Set(metrics.metric_books_by_period.map((d) => d.finish_year))].sort((a, b) => b - a);
const nf = new Intl.NumberFormat("en-GB");

function YearPicker(years) {
  const group = html`<div class="genres" role="group" aria-label="Pick a year"></div>`;
  group.value = years[0];
  for (const y of years) {
    const b = html`<button type="button" class="genre" aria-pressed=${String(y === years[0])}>${y}</button>`;
    b.onclick = () => {
      group.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      group.value = y;
      group.dispatchEvent(new Event("input", {bubbles: true}));
    };
    group.append(b);
  }
  return group;
}
```

<header class="page-head">
  <h1>A year of reading</h1>
  <p>Only books with a finish date count here, so the earlier undated shelf stays out of it.</p>
</header>

```js
const year = years.length ? view(YearPicker(years)) : null;
```

```js
if (year == null) {
  display(html`<p>No dated books yet. Once a finish date is logged in Hardcover, its year shows up here.</p>`);
} else {
  const books = metrics.metric_books_by_period.filter((d) => d.finish_year === year).reduce((n, d) => n + d.books_read, 0);
  const pages = metrics.metric_pages_read.find((d) => d.finish_year === year)?.pages_read ?? 0;
  const minutes = metrics.metric_reading_time.filter((d) => d.item_type === "book" && d.finish_year === year).reduce((n, d) => n + d.reading_minutes, 0);
  const yearBooks = shelf.filter((d) => d.shelf_status === "read" && d.finish_dates.some((f) => f.startsWith(String(year))));
  const rated = yearBooks.filter((d) => d.rating_10 != null);
  const best = rated.length ? rated.reduce((a, b) => (b.rating_10 > a.rating_10 ? b : a)) : null;
  const top = rated.filter((d) => d.rating_10 === best?.rating_10);

  display(html`<p class="year-sum">In ${year} I finished <strong>${books} ${books === 1 ? "book" : "books"}</strong>, about <strong>${nf.format(pages)} pages</strong>, roughly <strong>${nf.format(Math.round(minutes / 60))} hours</strong> of reading.${
    best ? html` The best of them${top.length > 1 ? ", tied at " + outOfFive(best.rating_10) : ""}: <em>${top.map((d) => d.title.split(":")[0]).join(" and ")}</em>.` : ""}</p>`);
  display(Bookcase(Shelf(yearBooks, {label: `Books finished in ${year}`})));
  display(html`<div class="section-head"><h2>The stamps</h2></div>`);
  display(html`<div class="two-up">${CheckoutCard(metrics, {year})}<div></div></div>`);
}
```
