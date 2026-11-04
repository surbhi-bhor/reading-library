import {test} from "node:test";
import assert from "node:assert/strict";
import {fromSearchDoc, buildRecommendation, asShelfBook, recommendedBy} from "../src/components/recommend.js";

test("an Open Library search result becomes a pick with only safe values", () => {
  assert.deepEqual(fromSearchDoc({key: "/works/OL27448W", title: "Circe", author_name: ["Madeline Miller", "x"], cover_i: 8231856, first_publish_year: 2018}),
    {title: "Circe", author: "Madeline Miller", ol_key: "/works/OL27448W", cover_id: 8231856, year: 2018});
  assert.deepEqual(fromSearchDoc({key: "javascript:alert(1)", title: "  Odd  ", cover_i: "9;x"}),
    {title: "Odd", author: null, ol_key: null, cover_id: null, year: null});
});

test("the row sent to Supabase is trimmed, capped and never pre-approved", () => {
  const pick = {title: "Circe", author: "Madeline Miller", ol_key: "/works/OL27448W", cover_id: 8231856, year: 2018};
  const row = buildRecommendation(pick, {name: "  Hu arsh  ", note: "x".repeat(600)});
  assert.deepEqual(Object.keys(row).sort(), ["author", "cover_id", "note", "ol_key", "recommended_by", "title"]);
  assert.equal(row.recommended_by, "Hu arsh");
  assert.equal(row.note.length, 500);
  assert.equal(buildRecommendation(pick, {name: "", note: "  "}).note, null);
});

test("a filled honeypot or a missing title sends nothing", () => {
  assert.equal(buildRecommendation({title: "Circe"}, {website: "http://spam"}), null);
  assert.equal(buildRecommendation({title: "  "}, {}), null);
});

test("an approved recommendation stands on the shelf like a book", () => {
  const b = asShelfBook({rec_id: "a1", title: "Butter", author: "Asako Yuzuki", cover_url: "c", cover_hd_url: "h", url: "u", recommended_by: "Hu arsh", note: "Amazing book", recommended_on: "2026-11-03"});
  assert.equal(b.item_id, "rec:a1");
  assert.equal(b.kind, "recommendation");
  assert.equal(b.summary, "Amazing book");
  assert.equal(recommendedBy(b), "Recommended by Hu arsh");
  assert.equal(recommendedBy({}), "Recommended by a reader");
});
