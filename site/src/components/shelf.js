import {spineLabel, spineStyle} from "./spine.js";
import {openBook} from "./bookPanel.js";

// One shelf of spines on a plank. `books` is the list the panel's
// previous/next walk through, so it should be the list as shown.
export function Shelf(books, {label, empty = "Nothing on this shelf yet."} = {}) {
  const shelf = document.createElement("div");
  shelf.className = "shelf";

  const row = document.createElement("div");
  row.className = "shelf-row";
  row.setAttribute("role", "list");
  if (label) row.setAttribute("aria-label", label);

  if (books.length === 0) {
    const p = document.createElement("p");
    p.className = "shelf-empty";
    p.textContent = empty;
    row.append(p);
  }

  books.forEach((book, index) => {
    const s = spineStyle(book);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spine";
    button.setAttribute("aria-label", book.author ? `${book.title} by ${book.author}` : book.title);
    button.dataset.reading = String(book.shelf_status === "reading");
    button.style.width = `${s.width}px`;
    button.style.height = `${s.height}%`;
    button.style.setProperty("--cloth", s.cloth);
    if (s.cover) button.style.setProperty("--cover", `url("${s.cover}")`);

    const title = document.createElement("span");
    title.className = "spine-title";
    title.textContent = spineLabel(book.title);
    button.append(title);

    button.addEventListener("click", () => openBook(books, index, button));
    // The wrapper is the list item, so the spine keeps its button role for screen readers.
    const item = document.createElement("div");
    item.setAttribute("role", "listitem");
    item.className = "spine-slot";
    item.style.height = button.style.height;
    button.style.height = "100%";
    item.append(button);
    row.append(item);
  });

  if (books.length > 0) {
    const bookend = document.createElement("span");
    bookend.className = "bookend";
    bookend.setAttribute("aria-hidden", "true");
    row.append(bookend);
  }

  const plank = document.createElement("div");
  plank.className = "plank";
  shelf.append(row, plank);
  return shelf;
}

// A bookcase holds one or more shelves.
export function Bookcase(...shelves) {
  const el = document.createElement("div");
  el.className = "bookcase";
  // Under about a dozen books the case shrinks to fit them.
  if (shelves.every((s) => s.querySelectorAll(".spine").length < 12)) el.classList.add("fit");
  el.append(...shelves);
  return el;
}

// Search + genre picker. Emits "input" like any Framework input so pages
// can use it with view(); its value is {query, genre}.
export function Finder(genres) {
  const form = document.createElement("form");
  form.className = "finder";
  form.setAttribute("role", "search");
  form.addEventListener("submit", (e) => e.preventDefault());
  form.value = {query: "", genre: null};

  const label = document.createElement("label");
  label.className = "visually-hidden";
  label.htmlFor = "finder-q";
  label.textContent = "Search by title or author";
  const input = document.createElement("input");
  input.type = "search";
  input.id = "finder-q";
  input.placeholder = "Search by title or author";
  input.autocomplete = "off";
  input.addEventListener("input", (e) => {
    e.stopPropagation();
    form.value = {...form.value, query: input.value.trim()};
    form.dispatchEvent(new Event("input", {bubbles: true}));
  });

  const group = document.createElement("div");
  group.className = "genres";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Filter by genre");
  const buttons = [{genre: null, reads: null}, ...genres].map(({genre, reads}) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "genre";
    b.setAttribute("aria-pressed", String(genre === null));
    b.append(genre ?? "All books");
    if (reads != null) {
      const n = document.createElement("small");
      n.textContent = reads;
      b.append(n);
    }
    b.addEventListener("click", () => {
      buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === b)));
      form.value = {...form.value, genre};
      form.dispatchEvent(new Event("input", {bubbles: true}));
    });
    return b;
  });
  group.append(...buttons);

  form.append(label, input, group);
  return form;
}

export function matches(book, {query, genre}) {
  if (genre && book.genre !== genre) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return book.title.toLowerCase().includes(q) || (book.author ?? "").toLowerCase().includes(q);
}
