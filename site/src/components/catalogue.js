// Metrics drawn as library objects. Every number comes from metrics.json;
// nothing here counts books itself.

const nf = new Intl.NumberFormat("en-GB");
const monthShort = new Intl.DateTimeFormat("en-GB", {month: "short", year: "numeric", timeZone: "UTC"});

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

const sum = (rows, key) => rows.reduce((n, d) => n + (d[key] ?? 0), 0);

export function outOfFive(rating10) {
  const r = Math.round((rating10 / 2) * 10) / 10;
  return `${r.toFixed(1)} of 5`;
}

export function ledgerFigures(m) {
  const books = m.metric_items_read.find((d) => d.item_type === "book");
  const rating = m.metric_avg_rating.find((d) => d.dimension === "type" && d.dimension_value === "book");
  return {
    books: books?.items_read ?? 0,
    pages: sum(m.metric_pages_read, "pages_read"),
    hours: Math.round(sum(m.metric_reading_time.filter((d) => d.item_type === "book"), "reading_minutes") / 60),
    rating: rating ? outOfFive(rating.avg_rating_10) : "none yet",
    ratedReads: rating?.rated_reads ?? 0,
    undated: m.metric_undated_reads.find((d) => d.item_type === "book")?.undated_reads ?? 0
  };
}


// Authors as an editorial index, rebuilt after the 21st.dev "Editorial service
// list" (ibrandify): numbered rows that shift a little on hover and open to the
// author's books on the shelf. Only authors with two or more books.
export function AuthorList(m, shelf, {open: openBook} = {}, n = 6) {
  const top = [...m.metric_top_creators].filter((d) => d.items_read >= 2).sort((a, b) => a.rank - b.rank).slice(0, n);
  const list = el("ol", {class: "editorial"});
  top.forEach((d, i) => {
    const books = shelf.filter((b) => b.shelf_status === "read" && (b.author ?? "").includes(d.creator_name));
    const panelId = `author-books-${i}`;
    const head = el("button", {class: "ed-row", type: "button", "aria-expanded": "false", "aria-controls": panelId},
      el("span", {class: "ed-num"}, String(i + 1).padStart(2, "0")),
      el("span", {class: "ed-name"}, d.creator_name),
      el("span", {class: "ed-note"}, `${d.items_read} books${d.avg_rating_10 != null ? ` · rated ${outOfFive(d.avg_rating_10)}` : ""}`),
      el("span", {class: "ed-chev", "aria-hidden": "true"}, "›"));
    const inner = el("ul", {class: "ed-books"}, ...books.map((b, k) => {
      const btn = el("button", {type: "button", class: "ed-book"}, b.title.split(":")[0].trim());
      btn.addEventListener("click", () => openBook?.(books, k, btn));
      return el("li", {}, btn);
    }));
    // The panel opens with a CSS grid-rows transition, so this file stays importable in node tests.
    const panel = el("div", {class: "ed-panel", id: panelId, role: "region", "aria-label": `Books by ${d.creator_name}`}, inner);
    head.addEventListener("click", () => head.setAttribute("aria-expanded", String(head.getAttribute("aria-expanded") === "false")));
    list.append(el("li", {class: "ed-item"}, head, panel));
  });
  return list;
}
