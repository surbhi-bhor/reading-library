
export default {
  title: "The Reading Library",
  root: "src",
  style: "style.css",
  sidebar: false,
  toc: false,
  pager: false,
  search: false,
  cleanUrls: true,
  pages: [
    {name: "Library", path: "/"},
    {name: "Shelves", path: "/shelves"},
    {name: "Catalogue", path: "/catalogue"},
    {name: "Year in review", path: "/year"},
    {name: "Stats", path: "/stats"},
    {name: "How it's made", path: "/about"}
  ],
  head: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Courier+Prime:wght@400;700&display=swap">
<meta name="description" content="Every book I have read, on wooden shelves. Rebuilt every night from my reading log.">`,
  header: ({path}) => {
    const links = [["shelves", "Shelves"], ["catalogue", "Catalogue"], ["year", "Year in review"], ["stats", "Stats"], ["about", "How it's made"]];
    const items = links.map(([href, name]) =>
      `<li><a href="./${href}"${path === `/${href}` ? ' aria-current="page"' : ""}>${name}</a></li>`).join("");
    return `<div class="ceiling" aria-hidden="true"><div class="starfield"></div></div><nav class="site-nav" aria-label="Library rooms"><a class="site-mark" href="./">The Reading Library</a><ul>${items}</ul></nav>`;
  },
  footer: `Rebuilt every night from my Hardcover reading log. <a href="./about">How it's made</a>.`,
  // Data loaders are Python; locally point PYTHON at the project venv.
  interpreters: {".py": [process.env.PYTHON ?? "python3"]}
};
