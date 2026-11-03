import {test} from "node:test";
import assert from "node:assert/strict";
import {CLOTHS, spineHeight, spineLabel, spineStyle, spineWidth} from "../src/components/spine.js";

test("spine width follows page count, clamped", () => {
  assert.equal(spineWidth(null), 36);
  assert.equal(spineWidth(100), 26);
  assert.equal(spineWidth(420), 42);
  assert.equal(spineWidth(2000), 64);
});

test("spine height is stable per book and between 84 and 100 percent", () => {
  assert.equal(spineHeight("book:1"), spineHeight("book:1"));
  for (const id of ["book:1", "book:2", "book:17256085", "book:x"]) {
    const h = spineHeight(id);
    assert.ok(h >= 84 && h <= 100, `${id} -> ${h}`);
  }
});

test("long titles are cut with an ellipsis", () => {
  const label = spineLabel("a".repeat(60));
  assert.equal(label.length, 38);
  assert.ok(label.endsWith("…"));
  assert.equal(spineLabel("Short title"), "Short title");
});

test("subtitles after a colon are dropped from the spine", () => {
  assert.equal(spineLabel("Atomic habits: An Easy & Proven Way"), "Atomic habits");
});

test("a book with no cover and no page count still gets a cloth spine", () => {
  const style = spineStyle({item_id: "book:9", cover_url: null, page_count: null});
  assert.equal(style.width, 36);
  assert.ok(CLOTHS.includes(style.cloth));
  assert.equal(style.cover, null);
});

test("a book with a cover uses the medium-size image on the spine", () => {
  const style = spineStyle({item_id: "book:9", cover_url: "https://covers.openlibrary.org/b/id/1-L.jpg", page_count: 300});
  assert.equal(style.cover, "https://covers.openlibrary.org/b/id/1-M.jpg");
});

test("a book whose cover colour is known uses it as cloth", () => {
  const style = spineStyle({item_id: "book:9", cover_url: null, page_count: 300, cover_rgb: [10, 20, 30]});
  assert.equal(style.cloth, "rgb(10 20 30)");
});
