
const el = (tag, cls, ...kids) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.append(...kids.filter((k) => k != null));
  return n;
};
const stars = (r) => "★".repeat(Math.floor(r / 2)) + (r % 2 ? "½" : "");

// The books I'd hand to anyone: rated 4.5 stars or more, most recent first.
export function topPicks(books, n = 6) {
  return books
    .filter((b) => b.shelf_status === "read" && (b.rating_10 ?? 0) >= 9)
    .sort((a, b) => b.rating_10 - a.rating_10 || String(b.last_finished ?? "").localeCompare(String(a.last_finished ?? "")))
    .slice(0, n);
}
