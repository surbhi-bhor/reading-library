import {animate, inView} from "npm:motion";

// A figure that counts up from zero the first time it scrolls into view.
// Ported from the 21st.dev Number Ticker (danielpetho) to plain DOM + Motion.
// The final value is in the text from the start, so screen readers, no-JS
// readers and reduced motion all get the real number.
export function Ticker(target, {decimals = 0, delay = 0} = {}) {
  const nf = new Intl.NumberFormat("en-GB", {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
  const span = document.createElement("span");
  span.className = "ticker";
  span.textContent = nf.format(target);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !(target > 0)) return span;
  span.setAttribute("aria-label", nf.format(target));
  inView(span, () => {
    animate(0, target, {duration: 1.6, delay, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => (span.textContent = nf.format(v))});
  }, {amount: 0.6});
  return span;
}

// A row of headline figures, each a counted number over a small label.
// figures: [{value, label, decimals?}]
export function Figures(figures, {label = "Headline figures"} = {}) {
  const dl = document.createElement("dl");
  dl.className = "figures";
  dl.setAttribute("aria-label", label);
  figures.forEach(({value, label, decimals}, i) => {
    const item = document.createElement("div");
    item.className = "figure";
    const dd = document.createElement("dd");
    dd.append(typeof value === "number" ? Ticker(value, {decimals, delay: i * 0.12}) : value);
    const dt = document.createElement("dt");
    dt.textContent = label;
    item.append(dt, dd); // CSS sets the number above its label
    dl.append(item);
  });
  return dl;
}
