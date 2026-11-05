// Spine colours taken from each book's own cover, so the shelf matches the books.

// pixels: RGBA bytes from a small canvas. Buckets colours coarsely and returns
// the average of the biggest bucket, skipping near-white and near-black margins
// unless the cover is nothing but those.
export function dominantColor(pixels) {
  const buckets = new Map();
  const fallback = [0, 0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
    if (a < 128) continue;
    fallback[0] += r; fallback[1] += g; fallback[2] += b; fallback[3]++;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 235 && min > 225) continue; // paper white
    if (max < 22) continue; // ink black
    const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const s = buckets.get(key) ?? [0, 0, 0, 0];
    s[0] += r; s[1] += g; s[2] += b; s[3]++;
    buckets.set(key, s);
  }
  let best = null;
  for (const s of buckets.values()) if (!best || s[3] > best[3]) best = s;
  const pick = best ?? fallback;
  if (pick[3] === 0) return [120, 110, 95];
  return pick.slice(0, 3).map((v) => Math.round(v / pick[3]));
}

// WCAG relative luminance decides whether ivory or ink reads better on the cloth.
export function inkFor([r, g, b]) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.33 ? "dark" : "light";
}

export const toCss = ([r, g, b]) => `rgb(${r} ${g} ${b})`;

// Browser only: read a cover's colour through a tiny canvas. Open Library
// serves covers with CORS, so the canvas is readable. Resolves null on failure.
export function coverColor(url, timeout = 5000) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), timeout);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 12;
        canvas.height = 18;
        const ctx = canvas.getContext("2d", {willReadFrequently: true});
        ctx.drawImage(img, 0, 0, 12, 18);
        resolve(dominantColor(ctx.getImageData(0, 0, 12, 18).data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

// The colour of a cover image that is already loaded (and CORS-readable).
export function imageColor(img) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 12;
    canvas.height = 18;
    const ctx = canvas.getContext("2d", {willReadFrequently: true});
    ctx.drawImage(img, 0, 0, 12, 18);
    return dominantColor(ctx.getImageData(0, 0, 12, 18).data);
  } catch {
    return null;
  }
}

// Colour spines from their covers. Results are cached per cover, so a filter
// that redraws the shelf does not fetch again. Resolves when every spine is done.
const cache = new Map();
export function paintSpines(pairs) {
  return Promise.all(pairs.map(({book, el}) => {
    if (!book.cover_url) return null;
    const url = book.cover_url.replace(/-[LM]\.jpg$/, "-S.jpg");
    if (!cache.has(url)) cache.set(url, coverColor(url));
    return cache.get(url).then((rgb) => {
      if (!rgb) return;
      book.cover_rgb = rgb; // the floating book uses the same cloth
      el.style.setProperty("--cloth", toCss(rgb));
      el.dataset.ink = inkFor(rgb);
    });
  }));
}
