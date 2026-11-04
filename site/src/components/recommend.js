// "Recommend a book": a visitor searches Open Library, picks a book, adds an
// optional name and note, and it goes into the Supabase table
// (supabase/recommendations.sql) with the public anon key. The table only
// accepts inserts. The nightly build checks the book against Open Library and
// puts it on the "Recommended to me" shelf with the name and note; no approval step.

const OL_KEY = /^\/works\/OL\d+W$/;
const clean = (v, n) => (String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n) || null);

// An Open Library search result, kept to values that are safe to send and show.
export function fromSearchDoc(doc) {
  return {
    title: clean(doc.title, 300),
    author: clean(doc.author_name?.[0], 200),
    ol_key: OL_KEY.test(doc.key ?? "") ? doc.key : null,
    cover_id: Number.isInteger(doc.cover_i) && doc.cover_i > 0 ? doc.cover_i : null,
    year: Number.isInteger(doc.first_publish_year) ? doc.first_publish_year : null
  };
}

// The row for Supabase. Null means send nothing: no title, or a bot filled the hidden field.
export function buildRecommendation(pick, {name, note, website} = {}) {
  if (website || !clean(pick?.title, 300)) return null;
  return {
    title: clean(pick.title, 300), author: clean(pick.author, 200), ol_key: pick.ol_key ?? null, cover_id: pick.cover_id ?? null,
    recommended_by: clean(name, 60), note: clean(note, 500)
  };
}

// The line above the title: "Recommended by Hu arsh", or "Recommended by a reader" when no name was given.
export const recommendedBy = (b) => `Recommended by ${b.recommended_by ?? "a reader"}`;

// A recommended book (publish.pub_recommendations) as a book on a shelf.
export function asShelfBook(r) {
  return {
    item_id: `rec:${r.rec_id}`, kind: "recommendation", title: r.title, author: r.author,
    cover_url: r.cover_url, cover_hd_url: r.cover_hd_url, url: r.url, recommended_on: r.recommended_on,
    recommended_by: r.recommended_by, summary: r.note, shelf_status: "want_to_read", finish_dates: []
  };
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (v != null) node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

// The button and its dialog. `config` is {url, anon_key}; without it there is no button.
export function RecommendButton(config) {
  if (!config?.url || !config?.anon_key) return el("span");
  const open = el("button", {type: "button", class: "recommend-open"}, "Recommend a book");
  const dialog = el("dialog", {class: "recommend", "aria-label": "Recommend a book"});
  const search = el("input", {type: "search", id: "rec-q", placeholder: "Search by title or author", autocomplete: "off"});
  const results = el("ul", {class: "rec-results", role: "listbox", "aria-label": "Books found"});
  const chosen = el("div", {class: "rec-chosen", hidden: ""});
  const name = el("input", {type: "text", id: "rec-name", maxlength: "60", autocomplete: "given-name"});
  const note = el("textarea", {id: "rec-note", maxlength: "500", rows: "3"});
  const trap = el("input", {type: "text", name: "website", tabindex: "-1", autocomplete: "off", class: "rec-trap", "aria-hidden": "true"});
  const send = el("button", {type: "submit", class: "rec-send", disabled: ""}, "Send recommendation");
  const status = el("p", {class: "rec-status", role: "status"});
  const close = el("button", {type: "button", class: "rec-close", "aria-label": "Close"}, "×");
  const form = el("form", {class: "rec-form", method: "dialog"},
    el("label", {for: "rec-q", class: "rec-label"}, "Recommend a book"), search, results, chosen,
    el("label", {for: "rec-name", class: "rec-field"}, "Your name ", el("small", {}, "(optional)")), name,
    el("label", {for: "rec-note", class: "rec-field"}, "Why should I read it? ", el("small", {}, "(optional)")), note,
    trap, send, status);
  dialog.append(close, form);
  let pick = null;
  let timer = 0;

  const choose = (p) => {
    pick = p;
    chosen.hidden = false;
    chosen.replaceChildren(el("strong", {}, p.title), p.author ? ` by ${p.author}` : "", p.year ? ` (${p.year})` : "");
    results.replaceChildren();
    send.disabled = false;
  };
  search.addEventListener("input", () => {
    clearTimeout(timer);
    const q = search.value.trim();
    if (q.length < 3) { results.replaceChildren(); return; }
    timer = setTimeout(async () => {
      try {
        const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,cover_i,first_publish_year&limit=6`);
        const docs = (await r.json()).docs ?? [];
        results.replaceChildren(...docs.map(fromSearchDoc).filter((p) => p.title).map((p) => {
          const b = el("button", {type: "button", role: "option"},
            p.cover_id ? el("img", {src: `https://covers.openlibrary.org/b/id/${p.cover_id}-S.jpg`, alt: "", width: "28", height: "42"}) : el("span", {class: "rec-nocover"}),
            el("span", {}, el("strong", {}, p.title), p.author ? el("small", {}, p.author) : null));
          b.addEventListener("click", () => choose(p));
          return el("li", {}, b);
        }));
      } catch { results.replaceChildren(el("li", {class: "rec-empty"}, "Search is not answering. Try again in a moment.")); }
    }, 350);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const row = buildRecommendation(pick, {name: name.value, note: note.value, website: trap.value});
    if (!row) return;
    send.disabled = true;
    status.textContent = "Sending…";
    try {
      const r = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/recommendations`, {
        method: "POST",
        headers: {"Content-Type": "application/json", apikey: config.anon_key, Authorization: `Bearer ${config.anon_key}`, Prefer: "return=minimal"},
        body: JSON.stringify(row)
      });
      if (!r.ok) throw new Error(String(r.status));
      status.textContent = `Thank you. ${row.title} joins the shelf after tonight’s update.`;
      pick = null;
      form.reset();
      chosen.hidden = true;
    } catch {
      status.textContent = "That did not go through. Please try again later.";
      send.disabled = false;
    }
  });
  open.addEventListener("click", () => { dialog.showModal(); search.focus(); });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  const wrap = el("span", {class: "recommend-wrap"}, open);
  document.body.append(dialog);
  return wrap;
}
