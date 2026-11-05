
export default {
  title: "The Reading Room",
  root: "src",
  style: "style.css",
  sidebar: false,
  toc: false,
  pager: false,
  search: false,
  cleanUrls: true,
  pages: [
    {name: "Library", path: "/"},
    {name: "Stats", path: "/stats"}
  ],
  // Framework 1.13 has no lang option, so set it before anything reads the page.
  head: `<script>document.documentElement.lang = "en";
// Vercel Web Analytics (no cookies). Added at load time because the script only
// exists on Vercel's servers, so the build cannot bundle it; skipped locally.
// Opening the site once with ?notrack stops counting this browser's visits
// (?track turns it back on).
try {
  const q = new URLSearchParams(location.search);
  if (q.has("notrack")) localStorage.setItem("no-analytics", "1");
  if (q.has("track")) localStorage.removeItem("no-analytics");
} catch {}
let optedOut = false;
try { optedOut = localStorage.getItem("no-analytics") === "1"; } catch {}
if (!optedOut && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  const va = document.createElement("script");
  va.defer = true;
  va.src = "/_vercel/insights/script.js";
  document.head.append(va);
}
// Dark by default; a choice made with the nav toggle is remembered.
// Read before first paint, so the page never flashes the other theme.
document.documentElement.dataset.theme = "dark";
try { const t = localStorage.getItem("theme"); if (t === "light") document.documentElement.dataset.theme = t; } catch {}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".theme-toggle");
  if (!b) return;
  const root = document.documentElement;
  const now = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const next = now === "light" ? "dark" : "light";
  root.dataset.theme = next;
  b.setAttribute("aria-pressed", String(next === "light"));
  try { localStorage.setItem("theme", next); } catch {}
});
document.addEventListener("DOMContentLoaded", () => {
  const light = (document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) === "light";
  document.querySelectorAll(".theme-toggle").forEach((b) => b.setAttribute("aria-pressed", String(light)));
});
</script>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiM3YTIyMzAiLz48cGF0aCBkPSJNMzIgMjFjLTIuNi0zLjQgMi44LTUuMiAwLTkuNk0zOC41IDIxYy0yLjYtMy40IDIuOC01LjIgMC05LjZNMjUuNSAyMWMtMi42LTMuNCAyLjgtNS4yIDAtOS42IiBmaWxsPSJub25lIiBzdHJva2U9IiNmM2U5ZDgiIHN0cm9rZS13aWR0aD0iMi40IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNMTIgMjZjNy0yLjYgMTQtMiAyMCAyLjJ2MjEuNmMtNi00LjItMTMtNC44LTIwLTIuMnoiIGZpbGw9IiNmM2U5ZDgiLz48cGF0aCBkPSJNNTIgMjZjLTctMi42LTE0LTItMjAgMi4ydjIxLjZjNi00LjIgMTMtNC44IDIwLTIuMnoiIGZpbGw9IiNlMDcwM2EiLz48cGF0aCBkPSJNMTYgMzFjNC42LTEuMiA4LjgtLjggMTIuNiAxLjJNMTYgMzZjNC42LTEuMiA4LjgtLjggMTIuNiAxLjJNMTYgNDFjNC42LTEuMiA4LjgtLjggMTIuNiAxLjIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzdhMjIzMCIgc3Ryb2tlLXdpZHRoPSIxLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iLjU1Ii8+PC9zdmc+">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=Courier+Prime:wght@400;700&display=swap">
<meta name="description" content="Everything I read, books and articles, on a 3D bookcase, with reading stats from a tested dbt warehouse. Rebuilt every week.">
<meta property="og:title" content="The Reading Room">
<meta property="og:description" content="Everything I read, books and articles, on a 3D bookcase, with reading stats from a tested dbt warehouse. Rebuilt every week.">
<meta property="og:image" content="https://reading-room-shelf.vercel.app/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://reading-room-shelf.vercel.app/">
<meta name="twitter:card" content="summary_large_image">`,
  header: ({path}) => {
    const links = [["stats", "Stats"]];
    const items = links.map(([href, name]) =>
      `<li><a href="./${href}"${path === `/${href}` ? ' aria-current="page"' : ""}>${name}</a></li>`).join("");
    // One button flips light and dark; the half-filled circle reads as either.
    const toggle = `<button type="button" class="theme-toggle" aria-label="Light mode" aria-pressed="false" title="Switch light and dark"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg></button>`;
    return `<nav class="site-nav" aria-label="Library rooms"><a class="site-mark" href="./"><svg class="site-logo" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#7a2230"/><path d="M32 21c-2.6-3.4 2.8-5.2 0-9.6M38.5 21c-2.6-3.4 2.8-5.2 0-9.6M25.5 21c-2.6-3.4 2.8-5.2 0-9.6" fill="none" stroke="#f3e9d8" stroke-width="2.4" stroke-linecap="round"/><path d="M12 26c7-2.6 14-2 20 2.2v21.6c-6-4.2-13-4.8-20-2.2z" fill="#f3e9d8"/><path d="M52 26c-7-2.6-14-2-20 2.2v21.6c6-4.2 13-4.8 20-2.2z" fill="#e0703a"/><path d="M16 31c4.6-1.2 8.8-.8 12.6 1.2M16 36c4.6-1.2 8.8-.8 12.6 1.2M16 41c4.6-1.2 8.8-.8 12.6 1.2" fill="none" stroke="#7a2230" stroke-width="1.4" stroke-linecap="round" opacity=".55"/></svg>The Reading Room</a><div class="site-nav-end"><ul>${items}</ul>${toggle}</div></nav>`;
  },
  footer: `<p class="site-foot">Code under the MIT licence. Book data from <a href="https://hardcover.app" rel="noopener">Hardcover</a> and <a href="https://openlibrary.org" rel="noopener">Open Library</a>.</p>`,
  // Data loaders are Python; locally point PYTHON at the project venv. Windows has no python3.
  interpreters: {".py": [process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3")]}
};
