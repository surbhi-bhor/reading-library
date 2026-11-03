import {spineLabel, spineStyle} from "./spine.js";

const dateFormat = new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"});
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

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

let dialog;
let current = {books: [], index: 0, opener: null};
let busy = false;

// The floating book: a real box with a cover, a spine and a page block.
function Book3D(book) {
  const s = spineStyle(book);
  const cover = book.cover_url
    ? el("img", {class: "v-cover", src: book.cover_url, alt: `Cover of ${book.title}`, width: "260", height: "390"})
    : el("div", {class: "v-cover v-cover-cloth"}, el("span", {}, book.title));
  return el("div", {class: "v-book", style: `--cloth: ${s.cloth}`},
    el("div", {class: "v-float"},
      el("div", {class: "v-box"},
        el("div", {class: "v-face v-front"}, cover),
        el("div", {class: "v-face v-spine", "aria-hidden": "true"}, el("span", {}, spineLabel(book.title, 30))),
        el("div", {class: "v-face v-pages", "aria-hidden": "true"}),
        el("div", {class: "v-face v-back", "aria-hidden": "true"}))));
}

function Details(book, index, total) {
  const facts = el("dl", {class: "v-facts"});
  const fact = (term, value) => { if (value != null && value !== "") facts.append(el("dt", {}, term), el("dd", {}, value)); };
  if (book.rating_10 != null) {
    fact("My rating", el("span", {}, el("span", {class: "stars", "aria-hidden": "true"}, stars(book.rating_10)), el("span", {class: "visually-hidden"}, `${book.rating_10 / 2} out of 5`)));
  } else fact("My rating", "Not rated");
  fact("Shelf", book.genre);
  fact("Pages", book.page_count ? String(book.page_count) : null);
  fact("First published", book.first_published_year ? String(book.first_published_year) : null);

  const prev = el("button", {class: "v-arrow", type: "button", "aria-label": "Previous book"}, "←");
  const next = el("button", {class: "v-arrow", type: "button", "aria-label": "Next book"}, "→");
  prev.disabled = index === 0;
  next.disabled = index === total - 1;
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  const close = el("button", {class: "btn btn-gold", type: "button"}, "Put it back");
  close.addEventListener("click", () => closeBook());

  const [main, ...rest] = book.title.split(":");
  return el("div", {class: "v-details"},
    el("p", {class: "v-count"}, el("span", {}, String(index + 1).padStart(2, "0")), el("span", {class: "v-count-rule", "aria-hidden": "true"}), el("span", {}, String(total).padStart(2, "0"))),
    el("p", {class: "v-status"}, status(book)),
    el("h2", {id: "book-title", class: "v-title"}, main.trim()),
    rest.length ? el("p", {class: "v-subtitle"}, rest.join(":").trim()) : null,
    book.author ? el("p", {class: "v-author"}, book.author) : null,
    facts,
    book.url?.startsWith("https://www.goodreads.com/") ? el("p", {class: "v-link"}, el("a", {href: book.url, target: "_blank", rel: "noopener"}, "Find it on Goodreads")) : null,
    el("div", {class: "v-actions"}, prev, next, close));
}

function ensureDialog() {
  if (dialog) return dialog;
  dialog = el("dialog", {class: "viewer", "aria-labelledby": "book-title"});
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeBook(); });
  dialog.addEventListener("click", (e) => { if (e.target === dialog || e.target.classList.contains("viewer-inner")) closeBook(); });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  document.body.append(dialog);
  return dialog;
}

// A little gold dust where the book lands.
function dust(host) {
  if (reducedMotion()) return;
  const burst = el("div", {class: "v-dust", "aria-hidden": "true"});
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 120 + (i % 3) * 40;
    burst.append(el("span", {style: `--dx:${(Math.cos(a) * r).toFixed(0)}px; --dy:${(Math.sin(a) * r).toFixed(0)}px; --delay:${(i % 5) * 40}ms`}));
  }
  host.append(burst);
  setTimeout(() => burst.remove(), 1600);
}

// The transform that puts the floating book exactly over the spine it came from.
function onTheShelf(opener, bookEl) {
  const start = opener?.isConnected ? opener.getBoundingClientRect() : null;
  if (!start || start.width === 0 || start.bottom < 0 || start.top > innerHeight) return null;
  const end = bookEl.querySelector(".v-box").getBoundingClientRect();
  const dx = start.left + start.width / 2 - (end.left + end.width / 2);
  const dy = start.top + start.height / 2 - (end.top + end.height / 2);
  return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(start.height / end.height).toFixed(3)}) rotateY(90deg)`;
}

const RESTING = "rotateY(-24deg)";

function render({fly = false} = {}) {
  const {books, index, opener} = current;
  const book = books[index];
  const bookEl = Book3D(book);
  const details = Details(book, index, books.length);
  dialog.replaceChildren(el("div", {class: "viewer-inner"}, details, bookEl));
  dialog.querySelector(".btn-gold").focus({preventScroll: true});
  // Fetch the neighbours' covers now, so Previous and Next never show an empty box.
  for (const n of [books[index - 1], books[index + 1]]) if (n?.cover_url) new Image().src = n.cover_url;
  if (reducedMotion()) return;

  const box = bookEl.querySelector(".v-box");
  const from = fly ? onTheShelf(opener, bookEl) ?? "translateY(60px) scale(0.85) rotateY(70deg)" : "rotateY(-100deg) translateX(40px)";
  box.animate([{transform: from, opacity: fly ? 1 : 0}, {transform: RESTING, opacity: 1}], {duration: fly ? 900 : 420, easing: EASE});
  [...details.children].forEach((child, i) => child.animate(
    [{opacity: 0, transform: "translateY(14px)"}, {opacity: 1, transform: "none"}],
    {duration: 520, delay: (fly ? 380 : 80) + i * 55, easing: EASE, fill: "backwards"}));
  if (fly) setTimeout(() => dialog.open && dust(bookEl), 650);
}

async function step(delta) {
  const next = current.index + delta;
  if (busy || next < 0 || next >= current.books.length) return;
  busy = true;
  const box = dialog.querySelector(".v-box");
  if (box && !reducedMotion()) {
    await box.animate([{transform: RESTING, opacity: 1}, {transform: `rotateY(${delta > 0 ? 70 : -110}deg) translateX(-40px)`, opacity: 0}],
      {duration: 240, easing: "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards"}).finished;
  }
  current.index = next;
  render();
  busy = false;
}

async function closeBook() {
  if (busy || !dialog?.open) return;
  busy = true;
  // Fly back onto the shelf only if the book shown is the one that was taken down.
  const sameBook = current.index === current.openedIndex;
  const box = dialog.querySelector(".v-box");
  if (box && !reducedMotion()) {
    const back = sameBook ? onTheShelf(current.opener, dialog.querySelector(".v-book")) : null;
    dialog.querySelector(".v-details")?.animate([{opacity: 1}, {opacity: 0}], {duration: 200, fill: "forwards"});
    dialog.classList.add("is-closing");
    await box.animate([{transform: RESTING, opacity: 1}, {transform: back ?? `${RESTING} translateY(40px) scale(0.9)`, opacity: back ? 1 : 0}],
      {duration: back ? 650 : 260, easing: back ? EASE : "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards"}).finished;
  }
  dialog.classList.remove("is-closing");
  dialog.close();
  current.opener?.focus({preventScroll: true});
  busy = false;
}

export function openBook(books, index, opener) {
  ensureDialog();
  current = {books, index, opener, openedIndex: index};
  if (!dialog.open) dialog.showModal();
  render({fly: true});
}
