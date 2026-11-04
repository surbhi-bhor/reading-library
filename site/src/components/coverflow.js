import {animate} from "npm:motion";
import {openBook, formatDate} from "./bookPanel.js";
import {spineStyle} from "./spine.js";

// The picks as a 3D coverflow, rebuilt in plain DOM + Motion after the 21st.dev
// "3D Coverflow Carousel" (dg.singh252525): the chosen book faces you under a
// warm glow, its neighbours turn away and dim, and the room behind takes the
// colour of the cover. Drag, swipe, the arrow keys or the round buttons move it.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const stars = (r) => "★".repeat(Math.floor(r / 2)) + (r % 2 ? "½" : "");

// Where a card sits for its distance from the centre card (pure, so it is testable).
export function coverflowPose(d) {
  const a = Math.abs(d);
  const side = Math.sign(d);
  return {
    x: side * (a === 0 ? 0 : 68 + (a - 1) * 38), // percent of card width
    z: -a * 160,
    rotateY: -side * Math.min(a, 1) * 38,
    scale: 1 - Math.min(a, 3) * 0.08,
    opacity: a > 2.5 ? 0 : 1 - a * 0.18,
    brightness: 1 - Math.min(a, 2) * 0.32
  };
}

export function Coverflow(books, {label = "Books worth reading"} = {}) {
  const root = document.createElement("section");
  root.className = "coverflow";
  root.setAttribute("aria-roledescription", "carousel");
  root.setAttribute("aria-label", label);

  const glow = document.createElement("div");
  glow.className = "cf-ambient";
  glow.setAttribute("aria-hidden", "true");

  const stage = document.createElement("div");
  stage.className = "cf-stage";
  stage.tabIndex = 0;
  stage.setAttribute("aria-label", `${label}. Left and right arrow keys turn the books; Enter opens the one in front.`);

  const live = document.createElement("p");
  live.className = "visually-hidden";
  live.setAttribute("aria-live", "polite");

  let active = Math.floor((books.length - 1) / 2); // start in the middle, books on both sides
  const cards = books.map((book, i) => {
    const s = spineStyle(book);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "cf-card";
    card.style.setProperty("--cloth", s.cloth);
    const src = book.cover_hd_url?.replace(/w=\d+/, "w=600") ?? s.cover;
    if (src) card.style.setProperty("--art", `url("${src}")`);
    const last = book.last_finished;
    card.innerHTML = `<span class="cf-tag"></span><span class="cf-text"><span class="cf-title"></span><span class="cf-author"></span><span class="cf-rule" aria-hidden="true"></span><span class="cf-why"></span><span class="cf-go">Take it down <span aria-hidden="true">→</span></span></span>`;
    card.querySelector(".cf-tag").textContent = book.genre;
    card.querySelector(".cf-title").textContent = book.title.split(":")[0].trim();
    card.querySelector(".cf-author").textContent = book.author ?? "";
    const why = card.querySelector(".cf-why");
    const st = document.createElement("span");
    st.className = "cf-stars";
    st.textContent = stars(book.rating_10);
    st.setAttribute("aria-label", `${book.rating_10 / 2} of 5 stars`);
    why.append(st, last ? `  ·  read ${formatDate(last).replace(/^\d+ /, "")}` : "");
    card.setAttribute("aria-label", `${book.title} by ${book.author}`);
    card.addEventListener("click", () => {
      if (moved) return;
      if (i === active) openBook(books, i, card);
      else go(i);
    });
    stage.append(card);
    return card;
  });

  const nav = (dir, text) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cf-arrow cf-${dir}`;
    b.setAttribute("aria-label", text);
    b.innerHTML = `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="${dir === "prev" ? "M12.5 4 6.5 10l6 6" : "M7.5 4l6 6-6 6"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    b.addEventListener("click", () => go(active + (dir === "prev" ? -1 : 1)));
    return b;
  };
  const prev = nav("prev", "Previous book");
  const next = nav("next", "Next book");

  const dots = document.createElement("div");
  dots.className = "cf-dots";
  dots.setAttribute("aria-hidden", "true");
  const dotEls = books.map((_, i) => {
    const d = document.createElement("i");
    d.addEventListener("click", () => go(i));
    dots.append(d);
    return d;
  });

  root.append(glow, stage, prev, next, dots, live);

  function layout(first = false) {
    cards.forEach((card, i) => {
      const p = coverflowPose(i - active);
      const opts = first || reduced() ? {duration: 0} : {type: "spring", stiffness: 170, damping: 24, mass: 0.9};
      animate(card, {x: `${p.x}%`, z: p.z, rotateY: p.rotateY, scale: p.scale, opacity: p.opacity, filter: `brightness(${p.brightness})`}, opts);
      card.style.zIndex = String(100 - Math.abs(i - active));
      card.classList.toggle("is-active", i === active);
      card.tabIndex = i === active ? 0 : -1;
      card.style.pointerEvents = Math.abs(i - active) > 2 ? "none" : "";
    });
    dotEls.forEach((d, i) => d.classList.toggle("on", i === active));
    prev.disabled = active === 0;
    next.disabled = active === books.length - 1;
    const book = books[active];
    glow.style.setProperty("--art", cards[active].style.getPropertyValue("--art") || "none");
    glow.style.setProperty("--cloth", cards[active].style.getPropertyValue("--cloth"));
    if (!first && !reduced()) animate(glow, {opacity: [0.35, 1]}, {duration: 0.6});
    live.textContent = `${active + 1} of ${books.length}: ${book.title} by ${book.author}`;
  }
  function go(i) {
    const k = Math.max(0, Math.min(books.length - 1, i));
    if (k === active) return;
    active = k;
    layout();
  }

  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
    if (e.key === "Enter" && e.target === stage) { e.preventDefault(); openBook(books, active, cards[active]); }
  });

  // Drag or swipe: a sideways pull of a fifth of a card moves one book.
  let start = null;
  let moved = false;
  stage.addEventListener("pointerdown", (e) => { start = e.clientX; moved = false; });
  stage.addEventListener("pointermove", (e) => {
    if (start == null) return;
    const dx = e.clientX - start;
    const step = cards[active].offsetWidth * 0.22;
    if (Math.abs(dx) > step) { moved = true; go(active + (dx < 0 ? 1 : -1)); start = e.clientX; }
  });
  const end = () => { start = null; setTimeout(() => (moved = false), 0); };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);

  layout(true);
  return root;
}
