import * as THREE from "npm:three";
import {GLTFLoader} from "npm:three/examples/jsm/loaders/GLTFLoader.js/+esm";
import {RoomEnvironment} from "npm:three/examples/jsm/environments/RoomEnvironment.js/+esm";
import {animate} from "npm:motion";
import {hash, spineLabel, spineStyle, spineHeight} from "./spine.js";
import {coverColor, inkFor, toCss} from "./color.js";
import {formatDate, openBook} from "./bookPanel.js";
import {ArcShelf} from "./shelf3d.js";
import {isLight, onThemeChange} from "./theme.js";
import {recommendedBy} from "./recommend.js";

// The shelf as a real lit 3D scene (three.js). Books are solid blocks: the
// spine printed from the cover, the cover on the front board, the page block
// on the fore-edge. Glide along by dragging, scrolling or with the arrow keys;
// pointing lifts a book; picking it slides it out and turns its cover to you,
// and picking it again takes it off the shelf. Without WebGL, the CSS shelf.

const GAP = 0.028; // a finger's breadth between books
let introPlayed = false;
const PX = 260; // canvas pixels per world unit, for printed spines
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Real objects on the shelf: photo-scanned Poly Haven models (CC0). Fetched
// once per page; every redraw of the shelf (each search) clones them.
const models = new Map();
const loadModel = (url) => {
  if (!models.has(url)) models.set(url, new GLTFLoader().loadAsync(url).then((g) => g.scene, () => null));
  return models.get(url);
};

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

function status(book) {
  if (book.kind === "recommendation") return recommendedBy(book);
  if (book.kind === "article") return ""; // articles carry no date: the saved day is not the day read
  if (book.shelf_status === "reading") return "Reading now";
  if (book.shelf_status === "want_to_read") return "On my list";
  const d = book.finish_dates ?? [];
  return d.length ? `Finished ${formatDate(d.at(-1))}` : "Finished, date not kept";
}

// The shelf is large now, so the medium Open Library cover (about 180px) blurs:
// take the large one, or ask the Hardcover resizer for a 500px copy.
function shelfCover(book) {
  const hd = book.cover_hd_url;
  if (hd?.includes("wsrv.nl")) return hd.replace(/([?&])w=\d+/, "$1w=500");
  return hd ?? book.cover_url;
}

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

// The printed spine: the cover's colour, the cover art cropped to the spine,
// a darker band at head and tail, the title and author set along it.
function spineCanvas(book, w, h, cloth, ink, img) {
  const c = document.createElement("canvas");
  c.width = Math.max(32, Math.round(w * PX));
  c.height = Math.round(h * PX);
  const g = c.getContext("2d");
  g.fillStyle = cloth;
  g.fillRect(0, 0, c.width, c.height);
  if (img) {
    g.globalAlpha = 0.72;
    const scale = c.height / img.height;
    g.drawImage(img, -img.width * scale * 0.06, 0, img.width * scale, c.height);
    g.globalAlpha = 1;
  }
  // Light from the left over a rounded back.
  const shade = g.createLinearGradient(0, 0, c.width, 0);
  shade.addColorStop(0, "rgba(0,0,0,0.45)");
  shade.addColorStop(0.2, "rgba(0,0,0,0)");
  shade.addColorStop(0.45, "rgba(255,255,255,0.14)");
  shade.addColorStop(0.7, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = shade;
  g.fillRect(0, 0, c.width, c.height);
  const light = ink === "light";
  g.save();
  g.translate(c.width / 2, c.height * 0.1);
  g.rotate(Math.PI / 2);
  g.textBaseline = "middle";
  g.shadowColor = light ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.5)";
  g.shadowBlur = 6;
  g.fillStyle = light ? "#f6f1e6" : "#1c1712";
  const size = Math.min(c.width * 0.5, 46);
  g.font = `600 ${size}px "Cormorant Garamond", Georgia, serif`;
  const title = spineLabel(book.title, 40);
  g.fillText(title, 0, 0, c.height * 0.66);
  g.font = `500 ${size * 0.58}px "Hanken Grotesk", sans-serif`;
  g.fillText((book.author ?? "").split(" ").at(-1), c.height * 0.7, 0, c.height * 0.16);
  g.restore();
  return c;
}

function boardCanvas(book, cloth, ink = "#f6f1e6") {
  const c = document.createElement("canvas");
  c.width = 330;
  c.height = 500;
  const g = c.getContext("2d");
  g.fillStyle = cloth;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = ink === "#f6f1e6" ? "rgba(255,255,255,0.35)" : "rgba(40,30,20,0.35)";
  g.lineWidth = 3;
  g.strokeRect(22, 22, c.width - 44, c.height - 44);
  g.fillStyle = ink;
  g.textAlign = "center";
  g.font = '600 38px "Cormorant Garamond", Georgia, serif';
  const words = spineLabel(book.title, 60).split(" ");
  const lines = [];
  for (const w of words) {
    const lineNow = lines.at(-1);
    if (lineNow && g.measureText(lineNow + " " + w).width < c.width - 80) lines[lines.length - 1] = lineNow + " " + w;
    else lines.push(w);
  }
  lines.forEach((l, i) => g.fillText(l, c.width / 2, 170 + i * 46));
  g.font = '500 22px "Hanken Grotesk", sans-serif';
  g.fillText(book.author ?? "", c.width / 2, c.height - 70);
  return c;
}

function pagesCanvas() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#e9e2d0";
  g.fillRect(0, 0, 64, 256);
  for (let x = 0; x < 64; x += 2) {
    g.fillStyle = `rgba(120,100,70,${0.08 + Math.random() * 0.1})`;
    g.fillRect(x, 0, 1, 256);
  }
  return c;
}

// The light an LED strip hidden under the top board throws down the wall:
// warm and bright at the top, fading to nothing.
function washCanvas() {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  const g = c.getContext("2d");
  const r = g.createLinearGradient(0, 0, 0, 256);
  r.addColorStop(0, "rgba(255,206,150,0.34)");
  r.addColorStop(0.3, "rgba(255,190,125,0.12)");
  r.addColorStop(1, "rgba(255,180,110,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 8, 256);
  return c;
}

// Tongue-and-groove panelling for the wall behind the shelf.
// Dark green in the evening room; pale painted sage in daylight (light mode).
function panelCanvas(base = "#1d3b2b") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 128) {
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(x, 0, 3, 512);
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.fillRect(x + 3, 0, 2, 512);
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.08})`;
      g.beginPath();
      const gx = x + 10 + Math.random() * 108;
      g.moveTo(gx, 0);
      for (let y = 0; y <= 512; y += 32) g.lineTo(gx + Math.sin(y / 70 + i) * 3, y);
      g.stroke();
    }
  }
  return c;
}

// A soft warm pool of light, laid over the wall and shelf under each lamp.
function glowCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, "rgba(255,200,130,0.55)");
  r.addColorStop(0.4, "rgba(255,180,100,0.2)");
  r.addColorStop(1, "rgba(255,170,90,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return c;
}

function woodCanvas() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#4a2e1c";
  g.fillRect(0, 0, 1024, 64);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 64;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? "20,10,4" : "120,80,50"},${0.15 + Math.random() * 0.25})`;
    g.lineWidth = 0.5 + Math.random() * 1.5;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 90 + i) * 2.5);
    g.stroke();
  }
  return c;
}

// `compartment` ("Recommended to me") makes this a lower compartment of the same
// bookcase: a brass plaque with its name and count inside, a shorter stage, no hint.
export function GLShelf(books, {label = "My books", empty = "Nothing on these shelves matches that.", invalidation, props = [], compartment = null} = {}) {
  if (books.length === 0 || !hasWebGL()) return ArcShelf(books, {label, empty});

  const root = document.createElement("section");
  root.className = compartment ? "gl-shelf is-compartment" : "gl-shelf";
  root.setAttribute("aria-label", label);
  root.setAttribute("aria-roledescription", "bookshelf");
  const stage = document.createElement("div");
  stage.className = "gl-stage";
  stage.tabIndex = 0;
  stage.setAttribute("aria-label", "Bookshelf. Arrow keys move along it; Enter takes the book out, Enter again opens it.");
  const panel = document.createElement("div");
  panel.className = "arc-panel";
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `<p class="arc-count"><span class="arc-n"></span><span class="arc-rule" aria-hidden="true"></span><span>${String(books.length).padStart(2, "0")}</span></p>
    <h2 class="arc-title"></h2><p class="arc-author"></p><p class="arc-status"></p>
    <button type="button" class="arc-open">Take it off the shelf</button>`;
  const hint = document.createElement("p");
  hint.className = "arc-hint";
  hint.textContent = "Drag, swipe sideways or use the arrow keys · click a book to take it out";
  // A scroller under the shelf, one tick per book: drag it to run along the case.
  const scrubLabel = document.createElement("label");
  scrubLabel.className = "visually-hidden";
  scrubLabel.textContent = "Move along the shelf";
  const scrub = document.createElement("input");
  scrub.type = "range";
  scrub.className = "arc-scrub";
  scrub.min = "0";
  scrub.max = String(books.length - 1);
  scrub.step = "1";
  scrub.id = `glscrub-${Math.random().toString(36).slice(2, 8)}`;
  scrubLabel.htmlFor = scrub.id;
  const ticks = document.createElement("div");
  ticks.className = "arc-ticks";
  ticks.setAttribute("aria-hidden", "true");
  books.forEach((_, i) => {
    const t = document.createElement("span");
    t.style.left = `${books.length === 1 ? 50 : (i / (books.length - 1)) * 100}%`;
    ticks.append(t);
  });
  const scrubWrap = document.createElement("div");
  scrubWrap.className = "arc-scrubber";
  scrubWrap.append(scrubLabel, ticks, scrub);
  if (compartment) {
    const plaque = document.createElement("p");
    plaque.className = "gl-plaque";
    plaque.innerHTML = `<span></span><small></small>`;
    plaque.querySelector("span").textContent = compartment;
    plaque.querySelector("small").textContent = String(books.length);
    stage.append(plaque);
  }
  root.append(stage, scrubWrap, panel, ...(compartment ? [] : [hint]));

  // ── Scene ──────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: "high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0c1d16, 7, 16);
  const camera = new THREE.PerspectiveCamera(28, 2, 0.1, 60);

  // Lamplight from above and in front, a cool fill from the wood, a warm rim.
  const sky = new THREE.HemisphereLight(0xf2e2c2, 0x1c4632, 0.8);
  scene.add(sky);
  const lamp = new THREE.SpotLight(0xffd7a0, 42, 0, 0.85, 0.75, 1.5);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(innerWidth < 760 ? 1024 : 2048, innerWidth < 760 ? 1024 : 2048);
  lamp.shadow.bias = -0.0004;
  lamp.shadow.radius = 6;
  scene.add(lamp, lamp.target);
  const rim = new THREE.DirectionalLight(0xff9a5a, 0.5);
  rim.position.set(-4, 3, -2);
  scene.add(rim);

  // Lay the books out along x, left to right.
  const metrics = books.map((book) => {
    // An article is a slim printed journal, shorter and thinner than a book.
    if (book.kind === "article") {
      const h = 1.05 + (spineHeight(book.item_id) - 84) / 16 * 0.2;
      return {book, h, w: 0.15, d: h * 0.72};
    }
    // A gentle spread of heights (1.55 to 1.8), so no book looks dwarfed by its neighbours.
    const h = 1.55 + (spineHeight(book.item_id) - 84) / 16 * 0.25;
    const w = Math.min(0.34, Math.max(0.13, (book.page_count ?? 300) / 1500));
    return {book, h, w, d: h * 0.66};
  });
  let x = 0;
  for (const m of metrics) { m.x = x + m.w / 2; x += m.w + GAP; }
  const length = x;
  const DEPTH = 1.35;

  // The shelf: a plank, a back board, bookends.
  const wood = new THREE.CanvasTexture(woodCanvas());
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = THREE.RepeatWrapping;
  wood.repeat.set(Math.ceil((length + 40) / 3), 1);
  const plankMat = new THREE.MeshStandardMaterial({map: wood, roughness: 0.62, metalness: 0.02});
  const plank = new THREE.Mesh(new THREE.BoxGeometry(length + 40, 0.12, DEPTH), plankMat);
  plank.position.set(length / 2, -0.06, 0);
  plank.receiveShadow = true;
  const lip = new THREE.Mesh(new THREE.BoxGeometry(length + 40, 0.05, 0.03), new THREE.MeshStandardMaterial({color: 0xb98a4a, roughness: 0.35, metalness: 0.6}));
  lip.position.set(length / 2, -0.02, DEPTH / 2);
  const back = new THREE.Mesh(new THREE.BoxGeometry(length + 40, 6, 0.05), new THREE.MeshStandardMaterial({color: 0x1c3a2a, roughness: 0.95}));
  back.position.set(length / 2, 2.6, -DEPTH / 2);
  back.receiveShadow = true;
  back.material.color.set(0xffffff);
  // The room follows the page: an evening library in dark mode, a daylit one in light mode.
  const panels = {};
  const panelFor = (light) => {
    if (!panels[light]) {
      const t = new THREE.CanvasTexture(panelCanvas(light ? "#c4cfbb" : "#1d3b2b"));
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set((length + 40) / 2.2, 6 / 2.2);
      panels[light] = t;
    }
    return panels[light];
  };
  const applyTheme = (redraw = true) => {
    const light = isLight();
    back.material.map = panelFor(light);
    back.material.needsUpdate = true;
    scene.fog.color.set(light ? 0xe6e2d4 : 0x0c1d16);
    sky.intensity = light ? 1.6 : 0.8;
    sky.groundColor.set(light ? 0x8a9a7c : 0x1c4632);
    renderer.toneMappingExposure = light ? 1.15 : 1.05;
    if (redraw) kick(); // not on the first call: the render loop is set up further down
  };
  applyTheme(false);
  const stopTheme = onThemeChange(() => applyTheme());
  // The shelf above frames the books from the top of the view.
  const top = new THREE.Mesh(new THREE.BoxGeometry(length + 40, 0.1, DEPTH), plankMat);
  top.position.set(length / 2, 2.2, 0); // low enough that its light strip stays in frame
  top.castShadow = top.receiveShadow = true;
  scene.add(plank, lip, back, top);

  // Modern shelf lighting: an LED strip hidden behind the top board's front edge,
  // as in a real bookcase. You see its light, not the strip: a warm wash down the
  // wall from just under the board, and soft pools on the books and the shelf.
  const glowMat = new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(glowCanvas()), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false});
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(length + 6, 1.4),
    new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(washCanvas()), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
  wash.position.set(length / 2, 2.15 - 0.7, -DEPTH / 2 + 0.035);
  scene.add(wash);
  for (let lx = 0.6; lx < length + 0.6; lx += 1.6) {
    // Soft light pools on the wall and the shelf below the strip.
    const wallGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), glowMat);
    wallGlow.position.set(lx, 1.22, -DEPTH / 2 + 0.03); // stays below the top board
    const plankGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, DEPTH), glowMat);
    plankGlow.rotation.x = -Math.PI / 2;
    plankGlow.position.set(lx, 0.002, 0);
    const glow = new THREE.PointLight(0xffd2a0, 1.1, 2.8, 1.6);
    glow.position.set(lx, 2.06, 0.6);
    scene.add(wallGlow, plankGlow, glow);
  }

  // Props stand just outside the bookends: {url, height, side: "start" | "end"}.
  // Metal and glaze only read as real with something to reflect: a soft room, on the props alone.
  const pmrem = props.length ? new THREE.PMREMGenerator(renderer) : null;
  const room = pmrem?.fromScene(new RoomEnvironment(), 0.04).texture;
  for (const prop of props) {
    loadModel(prop.url).then((model) => {
      if (!model || disposed) return;
      const obj = model.clone(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      obj.scale.setScalar(prop.height / size.y);
      box.setFromObject(obj);
      const width = box.max.x - box.min.x;
      // Base on the plank, centred in depth, a hand's width clear of the bookend.
      obj.position.x += (prop.side === "end" ? length + 0.2 + width / 2 : -0.2 - width / 2) - (box.min.x + box.max.x) / 2;
      obj.position.y -= box.min.y;
      obj.position.z += 0.05 - (box.min.z + box.max.z) / 2;
      obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.material.envMap = room; m.material.envMapIntensity = 0.6; } });
      scene.add(obj);
      kick();
    });
  }

  for (const ex of [-0.12, length + 0.12]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.55), new THREE.MeshStandardMaterial({color: 0xb98a4a, roughness: 0.35, metalness: 0.7}));
    end.position.set(ex, 0.55, 0);
    end.castShadow = true;
    scene.add(end);
  }

  const pages = new THREE.CanvasTexture(pagesCanvas());
  pages.colorSpace = THREE.SRGBColorSpace;
  const pageMat = new THREE.MeshStandardMaterial({map: pages, roughness: 0.9});

  // Each book is one group, so it can lift, slide and turn on its own.
  const items = metrics.map((m, index) => {
    const s = spineStyle(m.book);
    const cloth = new THREE.MeshStandardMaterial({color: 0x4a2e1e, roughness: 0.7});
    const spine = new THREE.MeshStandardMaterial({color: 0x4a2e1e, roughness: 0.55});
    const front = new THREE.MeshStandardMaterial({color: 0x4a2e1e, roughness: 0.5});
    // Box faces: +x front board, -x back board, +y top, -y bottom, +z spine, -z fore-edge.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(m.w, m.h, m.d), [front, cloth, pageMat, pageMat, spine, pageMat]);
    mesh.position.y = m.h / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(m.x, 0, 0);
    scene.add(group);
    // Not every book is pushed back to the wall: a fixed small step in or out per book.
    const z = -0.02 + ((hash(String(m.book.item_id)) >>> 8) % 7) * 0.01;
    return {...m, index, s, group, mesh, cloth, spine, front, z, spineBase: spine.color.clone(), lift: 0, out: 0, shift: 0};
  });

  // The shelf shows at once in plain cloth; each book is painted as its cover
  // arrives, since Open Library can take many seconds for all of them.
  const paint = async (it) => {
    if (disposed) return;
    const img = it.book.cover_url ? await loadImage(shelfCover(it.book)) : null;
    const rgb = it.book.cover_url ? await coverColor(it.book.cover_url.replace(/-[LM]\.jpg$/, "-S.jpg")) : null;
    if (disposed) return;
    const paper = it.book.kind === "article";
    const clothCss = rgb ? toCss(rgb) : paper ? "#e9dfc6" : "#4a2e1e";
    it.book.cover_rgb = rgb ?? it.book.cover_rgb;
    it.cloth.color.set(clothCss).convertSRGBToLinear();
    const tex = new THREE.CanvasTexture(spineCanvas(it.book, it.w, it.h, clothCss, rgb ? inkFor(rgb) : paper ? "dark" : "light", img));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    it.spine.map = tex;
    it.spineBase.set(0xffffff);
    it.spine.color.copy(it.spineBase);
    it.spine.needsUpdate = true;
    if (it.sharp) {
      // The full-size cover is already on; keep it.
    } else if (img) {
      const cover = new THREE.Texture(img);
      cover.colorSpace = THREE.SRGBColorSpace;
      cover.needsUpdate = true;
      it.front.map = cover;
      it.front.color.set(0xffffff);
      it.front.needsUpdate = true;
    } else {
      const board = new THREE.CanvasTexture(boardCanvas(it.book, clothCss, paper ? "#2a2018" : undefined));
      board.colorSpace = THREE.SRGBColorSpace;
      it.front.map = board;
      it.front.color.set(0xffffff);
      it.front.needsUpdate = true;
    }
    kick();
  };
  document.fonts.load('600 40px "Cormorant Garamond"').catch(() => {}).finally(() =>
    items.forEach(paint));
  let disposed = false;

  // ── State ─────────────────────────────────────────────────────────
  let focus = items[Math.min(items.length - 1, Math.floor(items.length / 3))].x;
  let target = focus;
  let hover = -1;
  let out = -1;
  let current = -1;
  let frame = 0;
  let last = 0;
  let visible = false;
  // 0 to 1 once, the first time the shelf is seen: the camera walks up to the
  // case and a ripple runs along the spines (driven by Motion, drawn by three.js).
  // Once per page visit: a search rebuilds the shelf and should not replay it.
  let intro = reducedMotion() || introPlayed ? 1 : 0;
  let introStarted = intro === 1;
  function startIntro() {
    if (introStarted) return;
    introStarted = introPlayed = true;
    animate(0, 1, {duration: 2.4, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { intro = v; kick(); }});
  }

  function setPanel(i) {
    if (i === current) return;
    current = i;
    scrub.value = String(i);
    scrubWrap.style.setProperty("--p", `${books.length === 1 ? 100 : (i / (books.length - 1)) * 100}%`);
    const {book} = items[i];
    panel.querySelector(".arc-n").textContent = String(i + 1).padStart(2, "0");
    panel.querySelector(".arc-title").textContent = book.title.split(":")[0].trim();
    panel.querySelector(".arc-author").textContent = book.author ?? "";
    panel.querySelector(".arc-status").textContent = status(book);
    // The caption changes like a card being swapped: out of focus, then in.
    if (!reducedMotion()) {
      animate(panel.querySelectorAll(".arc-title, .arc-author, .arc-status"),
        {opacity: [0, 1], y: [10, 0], filter: ["blur(6px)", "blur(0px)"]},
        {duration: 0.45, ease: [0.22, 1, 0.36, 1]});
    }
  }

  const nearest = (pos) => items.reduce((best, it) => (Math.abs(it.x - pos) < Math.abs(best.x - pos) ? it : best), items[0]).index;
  const clampX = (v) => Math.min(items.at(-1).x, Math.max(items[0].x, v));
  const goTo = (i) => { const k = Math.max(0, Math.min(items.length - 1, i)); target = items[k].x; out = -1; setPanel(k); kick(); };

  // The shelf paints small covers; the book taken out gets the full-size one,
  // fetched only then so the page does not load 35 large images.
  function sharpen(it) {
    if (it.sharpening || !it.book.cover_hd_url) return;
    it.sharpening = true;
    loadImage(it.book.cover_hd_url).then((img) => {
      if (!img || disposed) return;
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.needsUpdate = true;
      it.front.map?.dispose();
      it.front.map = tex;
      it.front.color.set(0xffffff);
      it.front.needsUpdate = true;
      it.sharp = true;
      kick();
    });
  }

  function takeOut(i) {
    if (out === i) { openBook(books, i, null); return; }
    sharpen(items[i]);
    out = i;
    target = items[i].x;
    setPanel(i);
    kick();
  }

  // ── Layout and render ─────────────────────────────────────────────
  function resize() {
    const w = stage.clientWidth || 1000;
    const h = stage.clientHeight || 420;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // A narrow stage is nearly square: the same lens, so the case's top board stays out of frame.
    camera.fov = 30;
    camera.updateProjectionMatrix();
    kick();
  }

  const follow = (v, to, dt, s) => (reducedMotion() ? to : v + (to - v) * (1 - Math.exp(-dt / s)));

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    focus = follow(focus, target, dt, 0.22);
    let moving = Math.abs(target - focus) > 0.0005;
    for (const it of items) {
      const wantLift = it.index === hover && it.index !== out ? 1 : 0;
      // The intro ripple: each book in turn pops forward and settles.
      const wave = intro < 1 ? Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, intro * 2 - it.index / items.length)))) : 0;
      const wantOut = it.index === out ? 1 : 0;
      const wantShift = out < 0 ? 0 : it.index < out ? -0.05 : it.index > out ? 0.05 : 0;
      it.lift = follow(it.lift, wantLift, dt, 0.09);
      it.out = follow(it.out, wantOut, dt, 0.28);
      it.shift = follow(it.shift, wantShift, dt, 0.2);
      // Pointing pulls a book forward a little and brightens its spine by a tenth.
      it.group.position.set(it.x + it.shift, it.out * 0.22 + wave * 0.06, it.z + it.lift * 0.08 + wave * 0.12 + it.out * 0.9);
      it.spine.color.copy(it.spineBase).multiplyScalar(1 + it.lift * 0.1);
      it.group.rotation.y = -it.out * (Math.PI / 2 - 0.28);
      if (Math.abs(it.lift - wantLift) > 0.0005 || Math.abs(it.out - wantOut) > 0.0005 || Math.abs(it.shift - wantShift) > 0.0005) moving = true;
    }
    const narrow = (stage.clientWidth || 1000) < 600;
    // Close enough that a spine's title reads at a glance; the walk-in starts further back.
    const walk = (1 - intro) * 3.2;
    camera.position.set(focus - walk * 0.4, (narrow ? 1.1 : 1.15) + walk * 0.15, (narrow ? 4.5 : 4.9) + walk);
    camera.lookAt(focus, 0.98, 0);
    lamp.position.set(focus + 1.2, 4.6, 3.6);
    lamp.target.position.set(focus, 0.6, 0);
    renderer.render(scene, camera);
    if (out < 0) setPanel(nearest(focus));
    if (intro < 1) moving = true;
    frame = visible && moving && !disposed ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!frame && visible && !disposed) { last = 0; frame = requestAnimationFrame(tick); } }

  const sizer = new ResizeObserver(resize);
  sizer.observe(stage);
  const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { startIntro(); kick(); } }, {rootMargin: "100px"});
  seen.observe(stage);

  // ── Input ─────────────────────────────────────────────────────────
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(items.map((it) => it.mesh))[0];
    return hit ? items.findIndex((it) => it.mesh === hit.object) : -1;
  };
  let drag = null;
  stage.addEventListener("pointerdown", (e) => { drag = {x: e.clientX, start: target, moved: false}; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 5) drag.moved = true;
      if (drag.moved) { target = clampX(drag.start - dx * 0.006); out = -1; kick(); return; }
    }
    const h = pick(e);
    if (h !== hover) { hover = h; stage.style.cursor = h >= 0 ? "pointer" : "grab"; kick(); }
  });
  stage.addEventListener("pointerup", (e) => {
    const wasDrag = drag?.moved;
    drag = null;
    if (wasDrag) { goTo(nearest(target)); return; }
    const i = pick(e);
    if (i >= 0) takeOut(i);
  });
  stage.addEventListener("pointerleave", () => { if (hover >= 0) { hover = -1; kick(); } });
  stage.addEventListener("wheel", (e) => {
    // Any wheel runs along the shelf; at either end the page scrolls on as usual.
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const next = clampX(target + delta * 0.004);
    if (next === target) return;
    e.preventDefault();
    target = next;
    out = -1;
    kick();
  }, {passive: false});
  scrub.addEventListener("input", () => goTo(Number(scrub.value)));
  stage.addEventListener("keydown", (e) => {
    const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    if (step) { e.preventDefault(); goTo(nearest(target) + step); }
    if (e.key === "Enter") { e.preventDefault(); takeOut(current >= 0 ? current : nearest(target)); }
  });
  panel.querySelector(".arc-open").addEventListener("click", () => openBook(books, current >= 0 ? current : nearest(target), null));

  // Framework re-runs the cell on every search, so the old shelf must free its GPU context.
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    sizer.disconnect();
    seen.disconnect();
    stopTheme();
    Object.values(panels).forEach((t) => t.dispose());
    room?.dispose();
    pmrem?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    for (const it of items) { it.mesh.geometry.dispose(); [it.spine, it.front, it.cloth].forEach((m) => { m.map?.dispose(); m.dispose(); }); }
  }

  setPanel(nearest(focus));
  invalidation?.then(dispose);
  return root;
}
