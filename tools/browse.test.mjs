/**
 * Browsing: which increments are shown, and how they are grouped.
 *
 * Exercised against the real data, so a change to the CSV files that would
 * break the interface is caught here rather than in a browser.
 *
 *     node --test tools/*.test.mjs
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadCategories } from "../assets/benson.js";
import { buildIndex, loadNotation } from "../assets/notation.js";
import { countsByCategory, sectionsFor, toggleFilter, visibleRows } from "../assets/browse.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relative) => readFile(path.join(ROOT, relative), "utf8");

const categories = await loadCategories({ readText });
const notation = await loadNotation({ readText });
const index = buildIndex(categories, notation);

const CH = "01_CH_Groups.csv";
const A_VALUES = "05_Cyclohexane_A_Values.csv";
const files = (...names) => new Set(names);

/* -------------------------------------------------------------------------- */
/* What is visible                                                              */
/* -------------------------------------------------------------------------- */

test("with nothing filtered, every increment is visible", () => {
  assert.equal(visibleRows(index).length, 236);
});

test("an empty filter means everything, not nothing", () => {
  // The chips narrow a complete list; they do not build one up from empty.
  assert.equal(visibleRows(index, { files: new Set() }).length, index.length);
});

test("one chosen category narrows to that category", () => {
  const rows = visibleRows(index, { files: files(CH) });
  assert.equal(rows.length, 44);
  assert.ok(rows.every((row) => row.category.file === CH));
});

test("categories add up rather than replacing one another", () => {
  const rows = visibleRows(index, { files: files(CH, A_VALUES) });
  assert.equal(rows.length, 44 + 29);
});

test("browsing keeps the order the data is written in", () => {
  const rows = visibleRows(index, { files: files(CH) });
  assert.equal(rows[0].label, "C-(C)(H)3", "the simplest group comes first, as the CSV has it");
});

/* -------------------------------------------------------------------------- */
/* Searching across, and within, the filter                                     */
/* -------------------------------------------------------------------------- */

test("a search spans every category when nothing is filtered", () => {
  const found = visibleRows(index, { query: "CH3" });
  assert.ok(found.length > 1);
  assert.equal(found[0].label, "C-(C)(H)3", "the plain methyl still wins the tie");
  assert.ok(new Set(found.map((row) => row.category.file)).size > 1,
    "a search should reach past one file");
});

test("a filter still applies while searching", () => {
  const found = visibleRows(index, { query: "CH3", files: files(A_VALUES) });
  assert.ok(found.length > 0);
  assert.ok(found.every((row) => row.category.file === A_VALUES));
});

test("a search that matches nothing returns nothing", () => {
  assert.equal(visibleRows(index, { query: "zzzz" }).length, 0);
});

/* -------------------------------------------------------------------------- */
/* Sections                                                                     */
/* -------------------------------------------------------------------------- */

test("browsing is grouped into one section per category, in file order", () => {
  const sections = sectionsFor(visibleRows(index));
  assert.deepEqual(sections.map((s) => s.key), categories.map((c) => c.file));
  assert.deepEqual(sections.map((s) => s.rows.length), [44, 82, 57, 24, 29]);
});

test("a section carries its category rather than a title string", () => {
  const [first] = sectionsFor(visibleRows(index));
  assert.equal(first.category.title, "CH Groups", "wording belongs to the rendering, not here");
});

test("searching collapses the sections, because relevance outranks the file", () => {
  const rows = visibleRows(index, { query: "CH3" });
  const sections = sectionsFor(rows, { query: "CH3" });
  assert.equal(sections.length, 1);
  assert.equal(sections[0].category, null);
  assert.equal(sections[0].rows.length, rows.length);
});

test("a search with no matches produces no sections at all", () => {
  assert.deepEqual(sectionsFor([], { query: "zzzz" }), []);
});

test("filtering to one category leaves exactly one section", () => {
  const rows = visibleRows(index, { files: files(A_VALUES) });
  assert.equal(sectionsFor(rows).length, 1);
});

test("every visible increment lands in exactly one section", () => {
  const rows = visibleRows(index);
  const sections = sectionsFor(rows);
  assert.equal(sections.reduce((n, s) => n + s.rows.length, 0), rows.length);
});

/* -------------------------------------------------------------------------- */
/* Counts and the filter itself                                                 */
/* -------------------------------------------------------------------------- */

test("chip counts describe what is visible, not what exists", () => {
  const all = countsByCategory(visibleRows(index));
  assert.equal(all.get(CH), 44);

  const searched = countsByCategory(visibleRows(index, { query: "CH3" }));
  assert.ok(searched.get(CH) < 44, "a search should shrink the count beside a chip");
});

test("a category with no visible rows has no count rather than a zero", () => {
  const counts = countsByCategory(visibleRows(index, { files: files(CH) }));
  assert.equal(counts.has(A_VALUES), false);
});

test("toggling adds a category, then removes it", () => {
  const once = toggleFilter(new Set(), CH);
  assert.deepEqual([...once], [CH]);
  assert.deepEqual([...toggleFilter(once, CH)], []);
});

test("toggling leaves the set it was given alone", () => {
  const original = files(CH);
  toggleFilter(original, A_VALUES);
  assert.deepEqual([...original], [CH], "the caller's set must not change under it");
});

/* -------------------------------------------------------------------------- */
/* What an entry carries                                                        */
/* -------------------------------------------------------------------------- */

test("a visible increment still knows how its source wrote the value", () => {
  // The index is the only thing a card is rendered from, so an entry that has
  // been narrowed to {label, value} loses the source's precision and renders
  // -20.9 as -21. Every field readValue produced has to survive the trip.
  const methylene = visibleRows(index).find((row) => row.label === "C-(C)2(H)2");
  assert.equal(methylene.source, "-20.9");
  assert.equal(methylene.decimals, 1);
  assert.equal(methylene.isRange, false);
});

test("a visible range still knows its bounds", () => {
  const oh = visibleRows(index).find((row) => row.label === "OH");
  assert.equal(oh.isRange, true);
  assert.equal(oh.low, 2.51);
  assert.equal(oh.high, 4.35);
});

test("every visible increment carries a source and a precision", () => {
  for (const row of visibleRows(index)) {
    assert.equal(typeof row.source, "string", `${row.label} lost its source text`);
    assert.equal(typeof row.decimals, "number", `${row.label} lost its precision`);
  }
});
