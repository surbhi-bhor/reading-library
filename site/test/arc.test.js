import {test} from "node:test";
import assert from "node:assert/strict";
import {arcPlacement, clampScroll} from "../src/components/arc.js";

const R = 1400;
const MAX = 0.6;

test("the book at the scroll position sits dead centre, facing the reader", () => {
  const p = arcPlacement(500, 500, R, MAX);
  assert.equal(p.x, 0);
  assert.equal(p.z, 0);
  assert.equal(p.rotateY, 0);
  assert.equal(p.visible, true);
  assert.equal(p.opacity, 1);
});

test("books either side mirror each other and curve toward the reader", () => {
  const left = arcPlacement(200, 500, R, MAX);
  const right = arcPlacement(800, 500, R, MAX);
  assert.ok(Math.abs(left.x + right.x) < 1e-9);
  assert.ok(left.z > 0 && Math.abs(left.z - right.z) < 1e-9);
  assert.ok(right.rotateY < 0 && left.rotateY > 0);
});

test("books beyond the visible arc are hidden", () => {
  assert.equal(arcPlacement(500 + R * 0.7, 500, R, MAX).visible, false);
  assert.equal(arcPlacement(500 - R * 0.7, 500, R, MAX).visible, false);
});

test("books fade out toward the ends of the arc", () => {
  const near = arcPlacement(500 + R * 0.1, 500, R, MAX).opacity;
  const far = arcPlacement(500 + R * 0.55, 500, R, MAX).opacity;
  assert.ok(near === 1 && far < 1 && far > 0);
});

test("scrolling stops at the first and last book", () => {
  assert.equal(clampScroll(-50, 1000), 0);
  assert.equal(clampScroll(1200, 1000), 1000);
  assert.equal(clampScroll(400, 1000), 400);
});
