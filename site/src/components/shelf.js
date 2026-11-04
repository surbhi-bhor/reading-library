import {animate} from "npm:motion";


// Search + genre picker. Emits "input" like any Framework input so pages
// can use it with view(); its value is {query, genre}.
export function Finder(genres) {
  const form = document.createElement("form");
  form.className = "finder";
  form.setAttribute("role", "search");
  form.addEventListener("submit", (e) => e.preventDefault());
  // A link to ./?genre=... opens the shelf on that genre.
  const asked = new URLSearchParams(location.search).get("genre");
  form.value = {query: "", genre: genres.some((g) => g.genre === asked) ? asked : null};

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
    b.setAttribute("aria-pressed", String(genre === form.value.genre));
    b.append(genre ?? "Everything");
    if (reads != null) {
      const n = document.createElement("small");
      n.textContent = reads;
      b.append(n);
    }
    b.addEventListener("click", () => {
      // A small press on a stiff spring, so the choice feels taken.
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) animate(b, {scale: [1, 0.93, 1]}, {type: "spring", stiffness: 520, damping: 18});
      buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === b)));
      form.value = {...form.value, genre};
      form.dispatchEvent(new Event("input", {bubbles: true}));
    });
    return b;
  });
  group.append(...buttons);

  // Header row, after the 21st.dev filter chips: a label, and Clear once anything is narrowed.
  const head = document.createElement("div");
  head.className = "finder-head";
  const title = document.createElement("span");
  title.className = "finder-label";
  title.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 4h7M12 4h2M2 12h3M8 12h6M9 2v4M5 10v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Filter by genre`;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "finder-clear";
  clear.textContent = "Clear";
  const sync = () => { clear.hidden = !form.value.query && !form.value.genre; };
  clear.addEventListener("click", () => {
    input.value = "";
    buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === 0)));
    form.value = {query: "", genre: null};
    form.dispatchEvent(new Event("input", {bubbles: true}));
    input.focus();
  });
  form.addEventListener("input", sync);
  sync();
  head.append(title, clear);

  const field = document.createElement("div");
  field.className = "finder-field";
  field.innerHTML = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m13 13 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  field.append(input);

  form.append(label, field, head, group);
  return form;
}

export function matches(book, {query, genre}) {
  if (genre && book.genre !== genre) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return book.title.toLowerCase().includes(q) || (book.author ?? "").toLowerCase().includes(q);
}
