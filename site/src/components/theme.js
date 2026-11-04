// The page theme: the nav toggle's choice (data-theme on <html>), else the system setting.
export const isLight = () =>
  (document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) === "light";

// Calls fn whenever the theme flips; returns a function that stops listening.
export function onThemeChange(fn) {
  const media = matchMedia("(prefers-color-scheme: light)");
  const watch = new MutationObserver(fn);
  watch.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
  media.addEventListener("change", fn);
  return () => { watch.disconnect(); media.removeEventListener("change", fn); };
}
