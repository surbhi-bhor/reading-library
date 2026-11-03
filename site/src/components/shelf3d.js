import {arcPlacement, clampScroll} from "./arc.js";
import {spineLabel, spineStyle} from "./spine.js";
import {paintSpines} from "./color.js";
import {formatDate, openBook} from "./bookPanel.js";

const GAP = 3;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function status(book) {
  if (book.shelf_status === "reading") return "Reading now";
  if (book.shelf_status === "want_to_read") return "On my list";
  const d = book.finish_dates ?? [];
  return d.length ? `Finished ${formatDate(d.at(-1))}` : "Finished, date not kept";
}

// The curved bookcase. Move along it by dragging, scrolling or with the arrow
// keys; the book in the middle slides out and turns to show its cover, and
// picking it takes it off the shelf.
export function ArcShelf(books, {label = "My books", empty = "Nothing on these shelves matches that."} = {}) {
  const root = document.createElement("section");
  root.className = "arc-shelf";
  root.setAttribute("aria-label", label);
  root.setAttribute("aria-roledescription", "bookshelf");

  if (books.length === 0) {
    const p = document.createElement("p");
    p.className = "shelf-empty arc-empty";
    p.textContent = empty;
    root.append(p);
    return root;
  }

  const stage = document.createElement("div");
  stage.className = "arc-stage is-loading";
  const ring = document.createElement("div");
  ring.className = "arc-ring";
  stage.append(ring);

  let u = 0;
  const items = books.map((book, index) => {
    const s = spineStyle(book);
    const width = Math.round(s.width * 1.25);
    const center = u + width / 2;
    u += width + GAP;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "book3d";
    button.tabIndex = -1;
    button.setAttribute("aria-label", book.author ? `${book.title} by ${book.author}` : book.title);
    button.dataset.reading = String(book.shelf_status === "reading");
    button.style.setProperty("--w", `${width}px`);
    button.style.setProperty("--hp", String(s.height / 100));
    button.style.setProperty("--cloth", s.cloth);
    button.style.setProperty("--i", String(index));
    button.innerHTML = `<span class="b-body"><span class="b-top"></span><span class="b-cover"></span><span class="b-spine"><span class="b-title"></span><span class="b-author"></span></span></span><span class="b-ledge"></span>`;
    button.querySelector(".b-title").textContent = spineLabel(book.title, 34);
    button.querySelector(".b-author").textContent = book.author ? book.author.split(" ").at(-1) : "";
    const cover = button.querySelector(".b-cover");
    if (s.cover) cover.style.backgroundImage = `url("${s.cover}")`;
    ring.append(button);
    return {book, button, center, width, index};
  });

  // The card beside the shelf, naming the book that is out.
  const panel = document.createElement("div");
  panel.className = "arc-panel";
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `<p class="arc-count"><span class="arc-n"></span><span class="arc-rule" aria-hidden="true"></span><span>${String(books.length).padStart(2, "0")}</span></p>
    <h2 class="arc-title"></h2><p class="arc-author"></p><p class="arc-status"></p>
    <button type="button" class="arc-open">Take it off the shelf</button>`;
  const openBtn = panel.querySelector(".arc-open");

  const scrubLabel = document.createElement("label");
  scrubLabel.className = "visually-hidden";
  scrubLabel.textContent = "Move along the shelf";
  const scrub = document.createElement("input");
  scrub.type = "range";
  scrub.className = "arc-scrub";
  scrub.min = "0";
  scrub.max = String(books.length - 1);
  scrub.step = "1";
  scrub.id = `scrub-${Math.random().toString(36).slice(2, 8)}`;
  scrubLabel.htmlFor = scrub.id;
  const ticks = document.createElement("div");
  ticks.className = "arc-ticks";
  ticks.setAttribute("aria-hidden", "true");
  items.forEach((it, i) => {
    const t = document.createElement("span");
    t.style.left = `${books.length === 1 ? 50 : (i / (books.length - 1)) * 100}%`;
    ticks.append(t);
  });
  const scrubWrap = document.createElement("div");
  scrubWrap.className = "arc-scrubber";
  scrubWrap.append(scrubLabel, ticks, scrub);
  const hint = document.createElement("p");
  hint.className = "arc-hint";
  hint.textContent = "Drag, scroll or use the arrow keys";
  const foot = document.createElement("div");
  foot.className = "arc-foot";
  foot.append(scrubWrap, hint);

  root.append(stage, panel, foot);

  // ── Motion ──────────────────────────────────────────────────────────
  let R = 1400;
  let maxTheta = 0.7;
  let current = 0;
  let target = 0;
  let frame = 0;
  let selected = -1;

  function layout() {
    const w = stage.clientWidth || 1000;
    R = Math.max(900, w * 1.15);
    maxTheta = Math.min(1.05, w / 2 / R + 0.2);
    const ringH = ring.clientHeight || 288;
    for (const it of items) {
      const h = ringH * Number(it.button.style.getPropertyValue("--hp"));
      it.button.style.setProperty("--hpx", `${h.toFixed(0)}px`);
      it.button.style.setProperty("--D", `${(h * 0.66).toFixed(0)}px`); // cover width: a real book's proportions
    }
  }

  // The first and last book can each come to the middle, no further.
  const bounds = () => [items[0].center, items.at(-1).center];

  function nearestIndex(pos) {
    let best = 0;
    for (const it of items) if (Math.abs(it.center - pos) < Math.abs(items[best].center - pos)) best = it.index;
    return best;
  }

  function select(i) {
    if (i === selected) return;
    if (selected >= 0) items[selected].button.classList.remove("is-out");
    selected = i;
    const {book, button} = items[i];
    button.classList.add("is-out");
    items.forEach((it) => (it.button.tabIndex = it.index === i ? 0 : -1));
    const [main] = book.title.split(":");
    panel.querySelector(".arc-n").textContent = String(i + 1).padStart(2, "0");
    panel.querySelector(".arc-title").textContent = main.trim();
    panel.querySelector(".arc-author").textContent = book.author ?? "";
    panel.querySelector(".arc-status").textContent = status(book);
    scrub.value = String(i);
    if (!reducedMotion()) panel.animate([{opacity: 0.25, transform: "translateY(6px)"}, {opacity: 1, transform: "none"}], {duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)"});
  }

  function render() {
    for (const it of items) {
      const p = arcPlacement(it.center, current, R, maxTheta);
      it.button.style.visibility = p.visible ? "visible" : "hidden";
      if (!p.visible) continue;
      it.button.style.opacity = String(p.opacity);
      it.button.style.transform = `translate3d(${p.x.toFixed(1)}px, 0, ${p.z.toFixed(1)}px) rotateY(${p.rotateY.toFixed(2)}deg)`;
    }
    select(nearestIndex(current));
  }

  function tick() {
    current += (target - current) * (reducedMotion() ? 1 : 0.12);
    if (Math.abs(target - current) < 0.4) current = target;
    render();
    frame = current === target ? 0 : requestAnimationFrame(tick);
  }

  function go(to) {
    const [lo, hi] = bounds();
    target = lo + clampScroll(to - lo, hi - lo);
    if (!frame) frame = requestAnimationFrame(tick);
  }

  const goTo = (i, {focus = false} = {}) => {
    const k = Math.max(0, Math.min(items.length - 1, i));
    go(items[k].center);
    if (focus) items[k].button.focus({preventScroll: true});
  };

  requestAnimationFrame(() => {
    layout();
    current = target = items[Math.min(items.length - 1, Math.floor(items.length / 3))].center;
    render();
  });
  new ResizeObserver(() => { layout(); render(); }).observe(stage);

  // Colour each spine from its cover, then let the shelf appear.
  const reveal = () => stage.classList.remove("is-loading");
  paintSpines(items.map((it) => ({book: it.book, el: it.button}))).then(reveal);
  setTimeout(reveal, 1800);

  // ── Input ───────────────────────────────────────────────────────────
  stage.addEventListener("wheel", (e) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const [lo, hi] = bounds();
    const next = lo + clampScroll(target + delta * 0.9 - lo, hi - lo);
    if (next === target) return; // at an end: let the page scroll on
    e.preventDefault();
    go(next);
  }, {passive: false});

  let drag = null;
  // Window listeners outlive a shelf that a filter re-rendered away; they unhook themselves.
  const listeners = new AbortController();
  const alive = () => root.isConnected || (listeners.abort(), false);
  stage.addEventListener("pointerdown", (e) => {
    drag = {x: e.clientX, start: target, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0};
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag || !alive()) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (!drag.moved) return;
    stage.classList.add("is-dragging");
    const dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    go(drag.start - dx * 1.3);
  }, {signal: listeners.signal});
  window.addEventListener("pointerup", () => {
    if (!drag || !alive()) return;
    const wasDrag = drag.moved;
    if (wasDrag) {
      // A flick keeps gliding, then settles on the nearest book.
      const glide = reducedMotion() ? target : target - drag.v * 240;
      goTo(nearestIndex(glide));
      stage.addEventListener("click", (ev) => { ev.stopPropagation(); ev.preventDefault(); }, {capture: true, once: true});
    }
    stage.classList.remove("is-dragging");
    drag = null;
  }, {signal: listeners.signal});

  scrub.addEventListener("input", () => goTo(Number(scrub.value)));
  openBtn.addEventListener("click", () => openBook(books, selected, items[selected].button));

  for (const it of items) {
    // Picking the book that is out takes it off the shelf; any other book is brought out first.
    it.button.addEventListener("click", () => {
      if (it.index === selected && Math.abs(target - it.center) < 2) openBook(books, it.index, it.button);
      else goTo(it.index);
    });
    it.button.addEventListener("focus", () => { if (it.index !== selected) goTo(it.index); });
    it.button.addEventListener("keydown", (e) => {
      const keys = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};
      if (e.key in keys) { e.preventDefault(); goTo(selected + keys[e.key], {focus: true}); }
      if (e.key === "Home") { e.preventDefault(); goTo(0, {focus: true}); }
      if (e.key === "End") { e.preventDefault(); goTo(items.length - 1, {focus: true}); }
    });
  }

  return root;
}
