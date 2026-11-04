// Leaf shadows falling across the shelf, as if a tree stood outside the window:
// soft, out-of-focus shapes, never drawn leaves. Seeded, so they are the same
// on every visit; each cluster drifts a little, like branches in a breeze.

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s >>>= 0) / 4294967296));
}

// A long pointed leaf (beech or ficus), centred on its stalk, `size` long.
const LEAF = "M0 0C3 -2 9 -3 14 -1C19 1 22 4 24 6C20 8 15 9 10 8C5 7 2 4 0 0Z";

export function Canopy({width = 1600, height = 480, clusters = 9, seed = 11} = {}) {
  const rand = seeded(seed);
  const parts = [];
  for (let c = 0; c < clusters; c++) {
    // Clusters sit along the top and down the two sides, clear of the middle.
    const side = c % 3;
    const cx = side === 0 ? rand() * width : side === 1 ? rand() * width * 0.22 : width - rand() * width * 0.22;
    const cy = side === 0 ? rand() * height * 0.25 : height * (0.15 + rand() * 0.5);
    const leaves = [];
    const n = 7 + Math.floor(rand() * 7);
    for (let i = 0; i < n; i++) {
      const a = rand() * 360;
      const r = 10 + rand() * 60;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.7;
      const size = 2.2 + rand() * 2.6;
      leaves.push(`<path d="${LEAF}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a + 90 + rand() * 60).toFixed(1)}) scale(${size.toFixed(2)})"/>`);
    }
    parts.push(`<g class="shade" style="--d:${(rand() * -9).toFixed(2)}s;--dx:${(4 + rand() * 8).toFixed(1)}px">${leaves.join("")}</g>`);
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "canopy");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<defs><filter id="leaf-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter></defs><g filter="url(#leaf-blur)">${parts.join("")}</g>`;
  return svg;
}
