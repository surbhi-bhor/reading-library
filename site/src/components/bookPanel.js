import {spineStyle} from "./spine.js";

const dateFormat = new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"});

export function formatDate(iso) {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

// "★★★★½" style, out of five. Hardcover rates in half stars.
export function stars(rating10) {
  const r = rating10 / 2;
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
}

function status(book) {
  if (book.shelf_status === "reading") return "Reading now";
  if (book.shelf_status === "want_to_read") return "On my list";
  const dates = book.finish_dates ?? [];
  if (dates.length === 0) return "Finished, date not kept";
  if (dates.length === 1) return `Finished ${formatDate(dates[0])}`;
  return `Read ${dates.length} times, last on ${formatDate(dates.at(-1))}`;
}

let dialog;
let current = {books: [], index: 0, opener: null};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

function ensureDialog() {
  if (dialog) return dialog;
  dialog = el("dialog", {class: "book-panel", "aria-labelledby": "book-title"});
  dialog.addEventListener("close", () => current.opener?.focus());
  // Click on the backdrop (outside the inner box) puts the book back.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  document.body.append(dialog);
  return dialog;
}

function step(delta) {
  const next = current.index + delta;
  if (next < 0 || next >= current.books.length) return;
  current.index = next;
  render();
}

function render() {
  const book = current.books[current.index];
  const s = spineStyle(book);

  const cover = book.cover_url
    ? el("img", {class: "book-cover", src: book.cover_url, alt: `Cover of ${book.title}`, width: "240", height: "360"})
    : el("div", {class: "book-cover book-cover-cloth", style: `--cloth: ${s.cloth}`, "aria-hidden": "true"}, book.title);

  const facts = el("dl", {class: "book-facts"});
  const fact = (term, value) => { if (value != null && value !== "") facts.append(el("dt", {}, term), el("dd", {}, value)); };
  if (book.rating_10 != null) {
    const r = book.rating_10 / 2;
    fact("My rating", el("span", {}, el("span", {class: "stars", "aria-hidden": "true"}, stars(book.rating_10)), el("span", {class: "visually-hidden"}, `${r} out of 5`)));
  } else {
    fact("My rating", "Not rated");
  }
  fact("Shelf", book.genre);
  fact("Pages", book.page_count ? String(book.page_count) : null);
  fact("First published", book.first_published_year ? String(book.first_published_year) : null);

  const prev = el("button", {class: "btn", type: "button"}, "Previous book");
  const next = el("button", {class: "btn", type: "button"}, "Next book");
  prev.disabled = current.index === 0;
  next.disabled = current.index === current.books.length - 1;
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  const close = el("button", {class: "btn btn-solid push", type: "button"}, "Put it back");
  close.addEventListener("click", () => dialog.close());

  const details = el("div", {},
    el("p", {class: "book-status"}, status(book)),
    el("h2", {id: "book-title"}, book.title),
    book.author ? el("p", {class: "book-author"}, book.author) : el("p", {class: "book-author"}),
    facts,
    book.url?.startsWith("https://www.goodreads.com/") ? el("p", {}, el("a", {href: book.url, target: "_blank", rel: "noopener"}, "Find it on Goodreads")) : null,
    el("div", {class: "book-actions"}, prev, next, close)
  );

  dialog.replaceChildren(el("div", {class: "book-panel-inner"}, cover, details));
  // preventScroll: on a phone, focusing the button would scroll the cover out of view.
  close.focus({preventScroll: true});
  dialog.scrollTop = 0;
}

export function openBook(books, index, opener) {
  ensureDialog();
  current = {books, index, opener};
  render();
  if (!dialog.open) dialog.showModal();
  dialog.querySelector(".btn-solid")?.focus({preventScroll: true});
  dialog.scrollTop = 0;
}
