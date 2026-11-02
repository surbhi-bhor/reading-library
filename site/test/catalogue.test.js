import {test} from "node:test";
import assert from "node:assert/strict";
import {filedName, ledgerFigures, outOfFive} from "../src/components/catalogue.js";

test("authors are filed surname first", () => {
  assert.equal(filedName("Amish Tripathi"), "Tripathi, Amish");
  assert.equal(filedName("Viktor E. Frankl"), "Frankl, Viktor E.");
  assert.equal(filedName("Sadhguru"), "Sadhguru");
});

test("ratings read out of five", () => {
  assert.equal(outOfFive(10), "5.0 of 5");
  assert.equal(outOfFive(7.928571428571429), "4.0 of 5");
});

test("ledger totals come straight from the metric tables, undated pages included", () => {
  const m = {
    metric_items_read: [{item_type: "book", items_read: 3}],
    metric_avg_rating: [{dimension: "type", dimension_value: "book", avg_rating_10: 8, rated_reads: 2}],
    metric_pages_read: [{finish_year: null, pages_read: 100}, {finish_year: 2026, pages_read: 200}],
    metric_reading_time: [{item_type: "book", finish_year: null, reading_minutes: 150}, {item_type: "book", finish_year: 2026, reading_minutes: 300}],
    metric_undated_reads: [{item_type: "book", undated_reads: 1}]
  };
  assert.deepEqual(ledgerFigures(m), {books: 3, pages: 300, hours: 8, rating: "4.0 of 5", ratedReads: 2, undated: 1});
});

test("an empty library gives zeros, not errors", () => {
  const m = {metric_items_read: [], metric_avg_rating: [], metric_pages_read: [], metric_reading_time: [], metric_undated_reads: []};
  assert.deepEqual(ledgerFigures(m), {books: 0, pages: 0, hours: 0, rating: "none yet", ratedReads: 0, undated: 0});
});
