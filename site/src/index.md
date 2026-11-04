---
title: The Reading Room
---

```js
import {Finder, matches} from "./components/shelf.js";
import {GLShelf} from "./components/shelfgl.js";
import {openBook, openFromHash} from "./components/bookPanel.js";
import {topPicks} from "./components/picks.js";
import {RecommendButton, asShelfBook} from "./components/recommend.js";

const shelf = await FileAttachment("data/shelf.json").json();
const mainShelf = await FileAttachment("data/bookcase.json").json();
const metrics = await FileAttachment("data/metrics.json").json();
const recommended = (await FileAttachment("data/recommendations.json").json()).map(asShelfBook);
const recommendConfig = await FileAttachment("data/recommend_config.json").json();

// Pills count books (spines), so a pill matches what clicking it shows.
const genres = [...metrics.metric_genre_mix].map((d) => ({genre: d.genre, reads: d.books})).sort((a, b) => b.reads - a.reads || a.genre.localeCompare(b.genre));
// The bookcase arrives in shelf order from the warehouse (publish.pub_bookcase):
// reading now first, then books and articles together by newest finish.
// Articles get their pill from metric_genre_mix, like every other shelf.
const articles = mainShelf.filter((d) => d.kind === "article");
const wantShelf = shelf.filter((d) => d.shelf_status === "want_to_read");
const picks = topPicks(shelf);

// A shared link (#book-123) opens that book straight away.
openFromHash([...shelf, ...articles, ...recommended]);

function surprise() {
  const pool = [...(picks.length ? picks : mainShelf), ...articles];
  openBook(pool, Math.floor(Math.random() * pool.length), null);
}
```

<h1 class="visually-hidden">Everything I’ve read</h1>

```js
// Above the shelf: search and genres to narrow it, or let the shop choose.
const lucky = html`<button type="button" class="surprise">Pick one for me</button>`;
lucky.onclick = surprise;
const finderForm = Finder(genres);
display(html`<div class="above-shelf">${finderForm}<div class="above-shelf-actions">${lucky}${RecommendButton(recommendConfig)}</div></div>`);
```

```js
// Genres are my shelf's own; the search box looks through every compartment.
const shown = mainShelf.filter((d) => matches(d, find));
const recShown = recommended.filter((d) => matches(d, {query: find.query}));
const wantShown = wantShelf.filter((d) => matches(d, {query: find.query}));
const filtered = find.query || find.genre;
const found = shown.length + recShown.length + wantShown.length;
// With no matches the shelf itself says so, so the status line stays quiet.
display(html`<p class="finder-status" aria-live="polite">${
  filtered && found ? `${found} of ${mainShelf.length + recommended.length + wantShelf.length} on the shelves` : ""
}</p>`);
// Real objects at either end of the shelf (Poly Haven, CC0; packed by scripts/pack_glb.py).
const props = [
  {url: await FileAttachment("models/brass_vase_01.glb").url(), height: 0.8, side: "start"},
  {url: await FileAttachment("models/potted_plant_02.glb").url(), height: 0.95, side: "end"}
];
display(GLShelf(shown, {label: "Books and articles I have read", empty: "Nothing on these shelves matches that.", invalidation, props}));
```

```js
// The lower compartments of the same bookcase: books readers sent me (publish.pub_recommendations),
// then the ones I want to read.
// A compartment with nothing matching the search folds away.
if (recShown.length > 0) display(GLShelf(recShown, {label: "Books readers recommended to me", compartment: "Recommended to me", invalidation}));
if (wantShown.length > 0) display(GLShelf(wantShown, {label: "Books I want to read", compartment: "On my list", invalidation}));
```

```js
const find = Generators.input(finderForm);
```

```js
// The picks on a coverflow (after the 21st.dev 3D Coverflow Carousel). The heading is drawn
// here with it, not as page text, so it cannot flash up before the shelves above have loaded.
import {Coverflow} from "./components/coverflow.js";
display(html`<section class="home-section">
  <h2>Worth reading</h2>
  <p class="section-lede">Books I rated four and a half stars or more.</p>
</section>`);
display(Coverflow(picks));
```


```js
// The tape deck in the corner of every room.
import {mountCassette} from "./components/cassette.js";
mountCassette();
```
