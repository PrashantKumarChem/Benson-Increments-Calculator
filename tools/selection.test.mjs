/**
 * Tests for the selection arithmetic and the value parser.
 *
 * Worked molecules are built from the real CSV files rather than from numbers
 * typed in here, so the expected totals stay correct if a published value is
 * ever revised: the test asserts the calculator adds up what the data says,
 * which is the property that must hold.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { InvalidValueError, KJ_TO_KCAL, loadCategories, parseValue } from "../assets/benson.js";
import { createSelection, keyOf } from "../assets/selection.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relative) => readFile(path.join(ROOT, relative), "utf8");

const categories = await loadCategories({ readText });

/** Look an increment up in the loaded data; fail loudly if the name is gone. */
function increment(file, label) {
  const category = categories.find((candidate) => candidate.file === file);
  assert.ok(category, `no category file ${file}`);
  const row = category.rows.find((candidate) => candidate.label === label);
  assert.ok(row, `no increment '${label}' in ${file}`);
  return { categoryFile: category.file, categoryTitle: category.title, label, value: row.value };
}

/** Add a molecule described as [increment, count] pairs. */
function build(selection, parts) {
  for (const [item, count] of parts) {
    for (let i = 0; i < count; i += 1) selection.add(item);
  }
}

const CH = "01_CH_Groups.csv";
const CORRECTIONS = "04_Corrections.csv";
const A_VALUES = "05_Cyclohexane_A_Values.csv";

test("parseValue reads plain numbers, including negatives", () => {
  assert.equal(parseValue("-42"), -42);
  assert.equal(parseValue("-20.9"), -20.9);
  assert.equal(parseValue("2"), 2);
  assert.equal(parseValue(" 3.4 "), 3.4);
});

test("parseValue averages a published range", () => {
  assert.equal(parseValue("1.05-1.76"), (1.05 + 1.76) / 2);
  assert.equal(parseValue("19.66-20.50"), (19.66 + 20.5) / 2);
});

test("parseValue rejects anything that is not a number or a range", () => {
  for (const bad of ["", "   ", "abc", "1.2.3", "--4"]) {
    assert.throws(() => parseValue(bad), InvalidValueError, `expected '${bad}' to be rejected`);
  }
});

test("decane totals two methyls plus eight methylenes", () => {
  const methyl = increment(CH, "C-(C)(H)3");
  const methylene = increment(CH, "C-(C)2(H)2");

  const selection = createSelection();
  build(selection, [[methyl, 2], [methylene, 8]]);

  assert.equal(selection.entries.length, 2, "repeat clicks should count, not repeat rows");
  assert.equal(selection.totalKj, 2 * methyl.value + 8 * methylene.value);
});

test("cyclohexane applies its ring correction on top of six methylenes", () => {
  const methylene = increment(CH, "C-(C)2(H)2");
  const ring = increment(CORRECTIONS, "cyclohexane");

  const selection = createSelection();
  build(selection, [[methylene, 6], [ring, 1]]);

  assert.equal(selection.totalKj, 6 * methylene.value + ring.value);
});

test("an averaged range value is carried into the total", () => {
  const fluorine = increment(A_VALUES, "F");
  assert.equal(fluorine.value, (1.05 + 1.76) / 2, "F is published as a range and should be averaged");

  const selection = createSelection();
  build(selection, [[fluorine, 2]]);
  assert.equal(selection.totalKj, 2 * fluorine.value);
});

test("the kcal figure is the kJ figure converted, not a separate sum", () => {
  const methyl = increment(CH, "C-(C)(H)3");
  const selection = createSelection();
  build(selection, [[methyl, 3]]);

  assert.equal(selection.totalKj * KJ_TO_KCAL, 3 * methyl.value * KJ_TO_KCAL);
});

test("steppers raise and lower a count, and zero removes the row", () => {
  const methyl = increment(CH, "C-(C)(H)3");
  const selection = createSelection();
  build(selection, [[methyl, 1]]);
  const key = keyOf(CH, methyl.label);

  selection.step(key, 1);
  assert.equal(selection.entries[0].count, 2);
  assert.equal(selection.totalKj, 2 * methyl.value);

  selection.step(key, -1);
  assert.equal(selection.entries[0].count, 1);

  selection.step(key, -1);
  assert.ok(selection.isEmpty, "a count of zero should drop the row");
  assert.equal(selection.totalKj, 0);
});

test("undo steps back one addition at a time, in order", () => {
  const methyl = increment(CH, "C-(C)(H)3");
  const methylene = increment(CH, "C-(C)2(H)2");

  const selection = createSelection();
  build(selection, [[methyl, 1], [methylene, 2]]);

  selection.undo();
  assert.equal(selection.totalKj, methyl.value + methylene.value);

  selection.undo();
  assert.equal(selection.totalKj, methyl.value);

  selection.undo();
  assert.ok(selection.isEmpty);

  selection.undo();  // undoing an empty selection must not throw
  assert.ok(selection.isEmpty);
});

test("undo also reverses a stepper increase", () => {
  const methyl = increment(CH, "C-(C)(H)3");
  const selection = createSelection();
  build(selection, [[methyl, 1]]);

  selection.step(keyOf(CH, methyl.label), 2);
  assert.equal(selection.entries[0].count, 3);

  selection.undo();
  assert.equal(selection.entries[0].count, 2, "undo should reverse the stepper, not only grid clicks");
});

test("remove clears the whole row whatever its count", () => {
  const methyl = increment(CH, "C-(C)(H)3");
  const methylene = increment(CH, "C-(C)2(H)2");

  const selection = createSelection();
  build(selection, [[methyl, 4], [methylene, 1]]);

  selection.remove(keyOf(CH, methyl.label));
  assert.equal(selection.entries.length, 1);
  assert.equal(selection.totalKj, methylene.value);

  selection.undo();
  assert.ok(selection.isEmpty, "undo must not resurrect a removed row");
});

test("the same group name in two categories stays separate", () => {
  const fromCh = increment(CH, "C-(C)(H)3");
  const alias = { ...fromCh, categoryFile: "99_Other.csv", categoryTitle: "Other" };

  const selection = createSelection();
  build(selection, [[fromCh, 1], [alias, 1]]);

  assert.equal(selection.entries.length, 2, "identical labels in different files are different increments");
});

test("reset empties everything", () => {
  const methyl = increment(CH, "C-(C)(H)3");
  const selection = createSelection();
  build(selection, [[methyl, 3]]);

  selection.clear();
  assert.ok(selection.isEmpty);
  assert.equal(selection.totalKj, 0);

  selection.undo();
  assert.ok(selection.isEmpty);
});

test("the reported entries cannot be mutated from outside", () => {
  const methyl = increment(CH, "C-(C)(H)3");
  const selection = createSelection();
  build(selection, [[methyl, 1]]);

  selection.entries[0].count = 99;
  assert.equal(selection.totalKj, methyl.value, "callers should not be able to edit the tally in place");
});
