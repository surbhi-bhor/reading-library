---
title: Catalogue
---

```js
import {AuthorCards, CheckoutCard, Drawers, Ledger} from "./components/catalogue.js";
const metrics = await FileAttachment("data/metrics.json").json();
```

<header class="page-head">
  <h1>The card catalogue</h1>
  <p>What the shelves add up to, kept the way a library keeps its records: a ledger, a drawer for every genre, and the stamps on my due-date card.</p>
</header>

```js
display(html`<div class="two-up">${Ledger(metrics)}${CheckoutCard(metrics)}</div>`);
```

<div class="section-head"><h2>A drawer for every genre</h2><p>The fuller the drawer, the more of my reading it holds.</p></div>

```js
display(Drawers(metrics));
```

<div class="section-head"><h2>Authors I keep going back to</h2></div>

```js
display(AuthorCards(metrics));
```
