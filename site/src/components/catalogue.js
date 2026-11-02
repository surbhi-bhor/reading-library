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

// "Amish Tripathi" -> "Tripathi, Amish", the way a catalogue files authors.
export function filedName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts.at(-1)}, ${parts.slice(0, -1).join(" ")}`;
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

export function Ledger(m) {
  const f = ledgerFigures(m);
  const row = (term, value, note) => el("div", {class: "ledger-row"},
    el("dt", {}, term), el("dd", {}, value), note ? el("dd", {class: "ledger-note"}, note) : null);
  return el("article", {class: "card ledger"},
    el("h3", {}, "Reading ledger"),
    el("dl", {},
      row("Books finished", nf.format(f.books)),
      row("Pages turned", nf.format(f.pages), "where the page count is known"),
      row("Hours of reading", `about ${nf.format(f.hours)}`, "at 40 pages an hour"),
      row("Average rating", f.rating, `over ${f.ratedReads} rated reads`),
      row("Kept without a date", nf.format(f.undated))
    ));
}

// One drawer per genre; drawer height follows its share of reads.
export function Drawers(m) {
  const ratings = new Map(m.metric_avg_rating.filter((d) => d.dimension === "genre").map((d) => [d.dimension_value, d.avg_rating_10]));
  const rows = [...m.metric_genre_mix].sort((a, b) => b.reads - a.reads || a.genre.localeCompare(b.genre));
  const max = Math.max(...rows.map((d) => d.share));
  return el("div", {class: "cabinet", role: "list", "aria-label": "Books read per genre"},
    ...rows.map((d) => el("div", {
      class: "drawer",
      role: "listitem",
      style: `--h: ${Math.max(3.25, 9 * (d.share / max)).toFixed(2)}rem`
    },
      el("span", {class: "drawer-label"},
        el("strong", {}, d.genre),
        el("span", {}, `${d.reads} ${d.reads === 1 ? "book" : "books"}, ${Math.round(d.share * 100)}% of my reading`),
        ratings.has(d.genre) ? el("span", {}, `rated ${outOfFive(ratings.get(d.genre))}`) : null),
      el("span", {class: "drawer-pull", "aria-hidden": "true"}))));
}

// A due-date card: one ink stamp per month with finished books, oldest first.
export function CheckoutCard(m, {year} = {}) {
  const months = m.metric_books_by_period
    .filter((d) => year == null || d.finish_year === year)
    .sort((a, b) => a.finish_year - b.finish_year || a.finish_month - b.finish_month);
  const undated = m.metric_undated_reads.find((d) => d.item_type === "book")?.undated_reads ?? 0;
  const stamps = months.map((d, i) => el("li", {class: "stamp-row"},
    el("span", {class: "stamp", style: `--tilt: ${((i * 37) % 7) - 3}deg`},
      monthShort.format(new Date(Date.UTC(d.finish_year, d.finish_month - 1, 1)))),
    el("span", {class: "stamp-count"}, `${d.books_read} ${d.books_read === 1 ? "book" : "books"}`)));
  return el("article", {class: "card checkout"},
    el("h3", {}, "Date due"),
    stamps.length ? el("ol", {class: "stamps"}, ...stamps) : el("p", {}, "No dated books yet."),
    year == null && undated ? el("p", {class: "checkout-note"}, `${undated} more read without a stamp.`) : null);
}

// Only authors with at least two books: "keep going back to" means it.
export function AuthorCards(m, n = 6) {
  const top = [...m.metric_top_creators].filter((d) => d.items_read >= 2).sort((a, b) => a.rank - b.rank).slice(0, n);
  return el("div", {class: "author-cards", role: "list"},
    ...top.map((d) => el("article", {class: "card author-card", role: "listitem"},
      el("h3", {}, filedName(d.creator_name)),
      el("p", {}, `${d.items_read} ${d.items_read === 1 ? "book" : "books"} read`),
      el("p", {}, d.avg_rating_10 != null ? `Rated ${outOfFive(d.avg_rating_10)}` : "Not rated"))));
}
