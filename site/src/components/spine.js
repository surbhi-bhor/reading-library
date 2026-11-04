// Spine geometry. Pure functions, so node:test can check them without a DOM.

// Bookcloth colours for books without a cover. Defined as tokens in style.css.
export const CLOTHS = [
  "var(--cloth-oxblood)",
  "var(--cloth-bottle)",
  "var(--cloth-navy)",
  "var(--cloth-mustard)",
  "var(--cloth-plum)",
  "var(--cloth-slate)",
  "var(--cloth-rust)",
  "var(--cloth-walnut)"
];

// FNV-1a: a stable small hash so a book keeps its height and cloth between builds.
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function spineWidth(pageCount) {
  if (pageCount == null) return 36;
  return Math.min(64, Math.max(26, Math.round(pageCount / 10)));
}

export function spineHeight(itemId) {
  return 84 + (hash(itemId) % 17);
}

export function spineLabel(title, max = 38) {
  const main = title.split(":")[0].trim();
  return main.length > max ? main.slice(0, max - 1).trimEnd() + "…" : main;
}

export function spineStyle(book) {
  return {
    width: spineWidth(book.page_count),
    height: spineHeight(book.item_id),
    // The cover's own colour once the page has read it; a bookcloth until then.
    cloth: book.cover_rgb ? `rgb(${book.cover_rgb.join(" ")})` : CLOTHS[hash(book.item_id + "#cloth") % CLOTHS.length],
    cover: book.cover_url ? book.cover_url.replace(/-L\.jpg$/, "-M.jpg") : null
  };
}
