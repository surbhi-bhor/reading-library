// The tape deck in the corner. All four tapes are made live with the Web
// Audio API, so there are no audio files to host or license. Sound starts
// only when the reader presses Play.

const TAPES = [
  {id: "brew", side: "A1", name: "Coffee brewing", make: brewTape},
  {id: "rain", side: "A2", name: "Rain on the windows", make: rainTape},
  {id: "jazz", side: "B1", name: "Café piano", make: jazzTape},
  {id: "hush", side: "B2", name: "Reading room hush", make: hushTape}
];

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Mono noise loop, `seconds` long. `crackle` adds sparse vinyl pops.
function noiseBuffer(ctx, seconds, {brown = false, crackle = 0} = {}) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    if (crackle && Math.random() < crackle) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6);
  }
  return buf;
}

function loop(ctx, buffer, out, gain, filter) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = gain;
  if (filter) { src.connect(filter); filter.connect(g); } else src.connect(g);
  g.connect(out);
  src.start();
  return src;
}

function biquad(ctx, type, frequency, Q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  return f;
}

// Each tape returns a function that stops everything it started.

// Plays a short filtered noise swell: a steam hiss, a page turn, a footstep.
function swell(ctx, out, buffer, {frequency, Q, peak, attack, hold = 0, release}) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + attack);
  g.gain.setValueAtTime(peak, now + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);
  src.connect(biquad(ctx, "bandpass", frequency, Q)).connect(g).connect(out);
  src.start(now);
  src.stop(now + attack + hold + release + 0.05);
}

// Calls fn now and then again at random gaps between min and max ms.
function every(fn, min, max) {
  let timer;
  const go = () => { fn(); timer = setTimeout(go, min + Math.random() * (max - min)); };
  timer = setTimeout(go, min);
  return () => clearTimeout(timer);
}

// A café counter: people talking, the espresso machine hissing and
// gurgling, cups set down on saucers.
function brewTape(ctx, out) {
  const talk = ctx.createGain();
  talk.gain.value = 0.45;
  talk.connect(out);
  const murmur = loop(ctx, noiseBuffer(ctx, 5, {brown: true}), talk, 1, biquad(ctx, "bandpass", 520, 1.2));
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 0.3;
  depth.gain.value = 0.15;
  lfo.connect(depth).connect(talk.gain);
  lfo.start();
  const hissBuf = noiseBuffer(ctx, 5);
  const gurgleBuf = noiseBuffer(ctx, 3, {brown: true});
  const stopSteam = every(() => {
    swell(ctx, out, hissBuf, {frequency: 5200, Q: 0.8, peak: 0.07, attack: 0.25, hold: 1.5 + Math.random() * 2, release: 0.8});
    setTimeout(() => swell(ctx, out, gurgleBuf, {frequency: 260, Q: 3, peak: 0.35, attack: 0.15, hold: 1.2, release: 0.6}), 900);
  }, 4000, 14000);
  const stopCups = every(() => {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 2300 + Math.random() * 1900;
    g.gain.setValueAtTime(0.03, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o.connect(g).connect(out);
    o.start(now);
    o.stop(now + 0.5);
  }, 1500, 6000);
  return () => { stopSteam(); stopCups(); lfo.stop(); murmur.stop(); };
}

// A big quiet room: low air, the odd page turned, distant footsteps.
function hushTape(ctx, out) {
  const room = loop(ctx, noiseBuffer(ctx, 4, {brown: true}), out, 0.55, biquad(ctx, "lowpass", 320));
  const air = loop(ctx, noiseBuffer(ctx, 3), out, 0.012, biquad(ctx, "bandpass", 900, 0.4));
  const pageBuf = noiseBuffer(ctx, 0.8);
  const stopPages = every(() => swell(ctx, out, pageBuf, {frequency: 2600 + Math.random() * 1500, Q: 0.6, peak: 0.08, attack: 0.18, release: 0.35}), 2500, 7000);
  const stopSteps = every(() => [0, 550, 1100, 1650].forEach((t) => setTimeout(() => swell(ctx, out, pageBuf, {frequency: 140, Q: 1.5, peak: 0.18, attack: 0.01, release: 0.12}), t)), 9000, 16000);
  return () => { stopPages(); stopSteps(); room.stop(); air.stop(); };
}

function rainTape(ctx, out) {
  const rain = loop(ctx, noiseBuffer(ctx, 4), out, 0.22, biquad(ctx, "lowpass", 2600));
  const room = loop(ctx, noiseBuffer(ctx, 4, {brown: true}), out, 0.5, biquad(ctx, "lowpass", 400));
  const hiss = loop(ctx, noiseBuffer(ctx, 3), out, 0.018, biquad(ctx, "highpass", 6000));
  const dropBuf = noiseBuffer(ctx, 0.05);
  // Single drops on the glass, at random.
  let timer;
  const drop = () => {
    const src = ctx.createBufferSource();
    src.buffer = dropBuf;
    const f = biquad(ctx, "bandpass", 1800 + Math.random() * 2600, 8);
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.12 + Math.random() * 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    src.connect(f).connect(g).connect(out);
    src.start(now);
    timer = setTimeout(drop, 40 + Math.random() * 260);
  };
  drop();
  return () => { clearTimeout(timer); [rain, room, hiss].forEach((s) => s.stop()); };
}

function jazzTape(ctx, out) {
  const crackle = loop(ctx, noiseBuffer(ctx, 5, {crackle: 0.0004}), out, 0.06, biquad(ctx, "bandpass", 3000, 0.5));
  const lofi = biquad(ctx, "lowpass", 2200);
  lofi.connect(out);
  // ii-V-I-VI in C, soft voicings, one chord every two bars.
  const chords = [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 61, 64, 67]];
  const note = (n, when, vel) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 3.2);
    g.connect(lofi);
    // A sine with a quiet octave on top reads as a soft, felted piano.
    [[1, 1], [2, 0.18]].forEach(([mult, level]) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = midi(n) * mult;
      og.gain.value = level;
      o.connect(og).connect(g);
      o.start(when);
      o.stop(when + 3.4);
    });
  };
  let step = 0;
  const bar = () => {
    const now = ctx.currentTime + 0.05;
    const chord = chords[step++ % chords.length];
    note(chord[0] - 12, now, 0.09);
    chord.slice(1).forEach((n, i) => note(n, now + 0.03 * i + Math.random() * 0.02, 0.05));
    // A short, lazy melody over the top.
    for (let k = 0; k < 3; k++) if (Math.random() < 0.7) note(chord[Math.floor(Math.random() * 4)] + 12, now + 0.9 + k * 0.75 + Math.random() * 0.15, 0.035);
  };
  bar();
  const timer = setInterval(bar, 3200);
  return () => { clearInterval(timer); crackle.stop(); };
}

let ctx;
let master;
let stopTape = null;
let tapeIndex = 0;

function startTape() {
  ctx ??= new AudioContext();
  ctx.resume();
  if (!master) { master = ctx.createGain(); master.connect(ctx.destination); }
  stopCurrent();
  // Each tape gets its own fader, so switching tapes crossfades.
  const fader = ctx.createGain();
  fader.gain.setValueAtTime(0, ctx.currentTime);
  fader.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 1.2);
  fader.connect(master);
  const stop = TAPES[tapeIndex].make(ctx, fader);
  stopTape = () => {
    fader.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => { stop(); fader.disconnect(); }, 1500);
  };
}

function stopCurrent() {
  stopTape?.();
  stopTape = null;
}

export function mountCassette() {
  if (document.querySelector(".deck")) return;
  const deck = document.createElement("details");
  deck.className = "deck";
  deck.open = false; // a small tab until someone wants sound
  deck.innerHTML = `<summary><span class="visually-hidden">Tape deck</span><span class="deck-tab" aria-hidden="true"></span></summary>
    <div class="deck-body">
      <div class="deck-window" aria-hidden="true">
        <span class="reel"></span><span class="tape-label"></span><span class="reel"></span>
      </div>
      <div class="deck-keys">
        <button type="button" class="deck-key" data-key="play" aria-pressed="false">Play</button>
        <button type="button" class="deck-key" data-key="stop">Stop</button>
      </div>
      <fieldset class="deck-tapes"><legend class="visually-hidden">Choose a tape</legend></fieldset>
    </div>`;
  const label = deck.querySelector(".tape-label");
  const play = deck.querySelector("[data-key=play]");
  const tapes = deck.querySelector(".deck-tapes");

  TAPES.forEach((tape, i) => {
    const id = `tape-${tape.id}`;
    const input = Object.assign(document.createElement("input"), {type: "radio", name: "tape", id, checked: i === 0});
    const lab = Object.assign(document.createElement("label"), {htmlFor: id});
    lab.innerHTML = `<span class="tape-side"></span> <span class="tape-name"></span>`;
    lab.querySelector(".tape-side").textContent = tape.side;
    lab.querySelector(".tape-name").textContent = tape.name;
    input.addEventListener("change", () => {
      tapeIndex = i;
      label.textContent = `${tape.side} · ${tape.name}`;
      if (deck.classList.contains("is-playing")) startTape();
    });
    tapes.append(input, lab);
  });
  label.textContent = `${TAPES[0].side} · ${TAPES[0].name}`;

  const setPlaying = (on) => {
    deck.classList.toggle("is-playing", on);
    play.setAttribute("aria-pressed", String(on));
  };
  play.addEventListener("click", () => {
    if (typeof AudioContext === "undefined") return;
    startTape();
    setPlaying(true);
  });
  deck.querySelector("[data-key=stop]").addEventListener("click", () => {
    stopCurrent();
    setPlaying(false);
  });
  document.body.append(deck);
}
