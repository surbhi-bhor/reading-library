---
title: The Reading Library
---

```js
import {Finder, matches} from "./components/shelf.js";
import {ArcShelf} from "./components/shelf3d.js";

const shelf = await FileAttachment("data/shelf.json").json();
const metrics = await FileAttachment("data/metrics.json").json();

const booksRead = metrics.metric_items_read.find((d) => d.item_type === "book")?.distinct_items ?? 0;
// Pills count books (spines), so a pill matches what clicking it shows.
const genres = [...metrics.metric_genre_mix].map((d) => ({genre: d.genre, reads: d.books})).sort((a, b) => b.reads - a.reads || a.genre.localeCompare(b.genre));
// Reading now goes first on the main shelf, then newest finish, undated last.
const mainShelf = [
  ...shelf.filter((d) => d.shelf_status === "reading"),
  ...shelf.filter((d) => d.shelf_status === "read")
];
const wantShelf = shelf.filter((d) => d.shelf_status === "want_to_read");
```

<header class="page-head">
  <h1>Everything I've read</h1>
  <p>${booksRead} books so far, newest on the left. Pull one off the shelf to see when I read it and what I thought of it.</p>
</header>

```js
const find = view(Finder(genres));
```

```js
const shown = mainShelf.filter((d) => matches(d, find));
const filtered = find.query || find.genre;
display(html`<p class="finder-status" aria-live="polite">${
  filtered ? (shown.length === 0 ? "Nothing on these shelves matches that." : `${shown.length} of ${mainShelf.length} books on the shelf`) : ""
}</p>`);
display(ArcShelf(shown, {label: "Books I have read", empty: "Nothing on these shelves matches that."}));
```

```js
if (wantShelf.length > 0) {
  display(html`<div class="section-head"><h2>On my list</h2><span class="plate">${wantShelf.length}</span></div>`);
  display(ArcShelf(wantShelf, {label: "Books I want to read"}));
}
```
