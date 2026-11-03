import {test} from "node:test";
import assert from "node:assert/strict";
import {dominantColor, inkFor, toCss} from "../src/components/color.js";

// RGBA pixels, as a canvas returns them.
const pixels = (...rgbs) => new Uint8ClampedArray(rgbs.flatMap(([r, g, b]) => [r, g, b, 255]));

test("the most common colour wins over a few odd pixels", () => {
  const red = [180, 30, 40];
  const c = dominantColor(pixels(red, red, red, red, [20, 120, 200], [250, 250, 250]));
  assert.ok(c[0] > 150 && c[1] < 60 && c[2] < 70, String(c));
});

test("near-white and near-black margins do not become the spine colour", () => {
  const white = [252, 252, 250];
  const black = [4, 4, 6];
  const teal = [30, 140, 150];
  const c = dominantColor(pixels(white, white, white, black, black, teal, teal));
  assert.ok(c[1] > 100 && c[2] > 100 && c[0] < 80, String(c));
});

test("an all-white cover still gives a colour (a soft paper tone)", () => {
  const c = dominantColor(pixels([250, 250, 250], [248, 248, 246]));
  assert.equal(c.length, 3);
});

test("dark cloth gets light ink, light cloth gets dark ink", () => {
  assert.equal(inkFor([30, 30, 60]), "light");
  assert.equal(inkFor([240, 220, 120]), "dark");
});

test("colours become CSS rgb() strings", () => {
  assert.equal(toCss([1, 2, 3]), "rgb(1 2 3)");
});
