/**
 * How values are written on the page.
 *
 * These are display decisions rather than arithmetic, but they are decisions:
 * showing `-42.00` where the source says `-42` claims a precision the data
 * does not have, and showing an averaged range as a bare number hides that it
 * was averaged. Both are worth holding in place.
 *
 * Run with the rest:
 *
 *     node --test tools/*.test.mjs
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadArtifact } from "../assets/benson.js";
import {
  MINUS,
  ELEMENT_NAMES,
  combinedUncertainty,
  describeMethodUncertainty,
  describeTotal,
  formatIncrement,
  formatKcal,
  formatRange,
  formatSelectionAsText,
  formatTotal,
  rangeSpread,
  sourceOf,
} from "../assets/format.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { categories, index: rows, references, uncertainty } = await loadArtifact({
  readText: (relative) => readFile(path.join(ROOT, relative), "utf8"),
  path: "dist/increments.json",
});
const find = (label) => rows.find((row) => row.label === label);

/**
 * A reading with just enough shape for formatIncrement()/formatRange(): the
 * value-parsing this used to exercise (readValue from assets/benson.js) moved
 * to benson/values.py at WP3, and benson/tests/test_values.py tests it now.
 * What is left to test here is formatting, which only needs the shape.
 */
const reading = (value, decimals, isRange = false, low = null, high = null) =>
  ({ value, decimals, isRange, low, high });

/* -------------------------------------------------------------------------- */
/* Precision                                                                    */
/* -------------------------------------------------------------------------- */

test("a whole number is shown as one, not padded to two decimals", () => {
  assert.equal(formatIncrement(reading(-42, 0)), `${MINUS}42`);
  assert.equal(formatIncrement(reading(118, 0)), "+118");
});

test("a source with one decimal keeps exactly one", () => {
  assert.equal(formatIncrement(reading(-20.9, 1)), `${MINUS}20.9`);
  assert.equal(formatIncrement(reading(13.8, 1)), "+13.8");
});

test("a source with two decimals keeps exactly two", () => {
  assert.equal(formatIncrement(reading(0.03, 2)), "+0.03");
});

test("zero carries no sign", () => {
  assert.equal(formatIncrement(reading(0, 0)), "0");
});

test("the minus shown is a real minus sign, not a hyphen", () => {
  assert.ok(formatIncrement(reading(-7, 0)).startsWith(MINUS));
  assert.notEqual(MINUS, "-");
});

test("every increment in the data renders no more precisely than its source", () => {
  for (const category of categories) {
    for (const row of category.rows) {
      if (row.isRange) continue;
      const shown = formatIncrement(row).replace(MINUS, "").replace("+", "");
      const places = (shown.split(".")[1] ?? "").length;
      assert.equal(places, row.decimals,
        `${row.label} is written '${row.source}' but renders as '${shown}'`);
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Ranges                                                                       */
/* -------------------------------------------------------------------------- */

test("an averaged range shows the bounds it was averaged from", () => {
  const oh = find("OH");
  assert.equal(oh.isRange, true);
  assert.equal(formatRange(oh), "2.51–4.35");
  assert.equal(formatIncrement(oh), "+3.43");
});

test("a midpoint may need one more decimal than its bounds", () => {
  // 1.05 and 1.76 average to 1.405, which two decimals would round away.
  const fluorine = find("F");
  assert.equal(formatIncrement(fluorine), "+1.405");
  assert.equal(formatRange(fluorine), "1.05–1.76");
});

test("a midpoint that lands cleanly is not padded", () => {
  // 2.22 and 2.68 average to exactly 2.45, so the third place is dropped.
  assert.equal(formatIncrement(find("Cl")), "+2.45");
});

test("a plain number has no range to show", () => {
  assert.equal(formatRange(reading(-42, 0)), null);
});

test("the range dash is not a minus sign", () => {
  assert.ok(!formatRange(find("OH")).includes(MINUS));
});

test("the spread is half a range's width, times how many were chosen", () => {
  const oh = find("OH");
  assert.equal(rangeSpread([{ ...oh, count: 1 }]), (4.35 - 2.51) / 2);
  assert.equal(rangeSpread([{ ...oh, count: 3 }]), ((4.35 - 2.51) / 2) * 3);
});

test("increments that are not ranges contribute no spread", () => {
  assert.equal(rangeSpread([{ ...find("C-(C)(H)3"), count: 4 }]), 0);
});

/* -------------------------------------------------------------------------- */
/* Method uncertainty (D11, D12 - a separate slot from the range spread above)  */
/* -------------------------------------------------------------------------- */

test("ten groups at +-3 report the method figure, not the quadrature sum", () => {
  const tenAtThree = Array(10).fill(3);
  assert.equal(combinedUncertainty(tenAtThree, 5.5), 5.5,
    "quadrature would give about 9.5 here - D11 says display 5.5 instead");
});

test("nothing chosen is still the method figure, not zero", () => {
  assert.equal(combinedUncertainty([], 5.5), 5.5);
});

/* -------------------------------------------------------------------------- */
/* What the line under the total says                                           */
/* -------------------------------------------------------------------------- */

const byFile = new Map(categories.map((category) => [category.file, category]));
/** A chosen increment, in the shape assets/selection.js keeps one. */
const chosen = (row, count = 1) => ({ ...row, categoryFile: row.category.file, count });
const say = (entries, figures = uncertainty) => describeMethodUncertainty(entries, byFile, figures, references);
const textOf = (said) => said.sentences.map((sentence) => sentence.text);

// Found by what they are rather than by name, so a renamed group cannot turn
// one of these into a different kind of total without the test noticing.
const enthalpy = (holds) => rows.find((row) => row.category.symbol === "ΔHf°" && holds(row.composition ?? {}));
const HYDROCARBON = enthalpy((atoms) => atoms.C && atoms.H && !atoms.O && !atoms.N);
const OXYGEN = enthalpy((atoms) => atoms.O && !atoms.N);
const NITROGEN = enthalpy((atoms) => atoms.N);
const A_VALUE = rows.find((row) => row.category.symbol === "ΔG°");
const COHEN = references.find((reference) => reference.key === "Cohen1996");
const LEAD = "Benson estimates of gas-phase ΔHf° are typically off by about 5.5 kJ/mol.";

test("the figure served is Cohen 1996's, for gas-phase ΔHf° of carbon, hydrogen and oxygen", () => {
  // The owner chose this figure and its wording. Changing either is a decision
  // about what students are told, so it is made here on purpose or not at all.
  assert.ok(HYDROCARBON && OXYGEN && NITROGEN && A_VALUE && COHEN, "a fixture row or reference is missing");
  assert.deepEqual(
    uncertainty.map(({ symbol, value, unit, phase, elements, ref }) => ({ symbol, value, unit, phase, elements, ref })),
    [{ symbol: "ΔHf°", value: 5.5, unit: "kJ/mol", phase: "gas", elements: ["C", "H", "O"], ref: "Cohen1996" }],
  );
});

test("nothing chosen says nothing about the method's error", () => {
  assert.equal(say([]), null);
});

test("a total of carbon, hydrogen and oxygen groups gets the figure, citing its reference and note", () => {
  assert.deepEqual(say([chosen(HYDROCARBON, 2), chosen(OXYGEN)]).sentences,
    [{ text: LEAD, ref: COHEN.number, figure: 0 }]);
});

test("a total of A-values alone is told the figure is not for it", () => {
  assert.deepEqual(say([chosen(A_VALUE, 2)]).sentences, [{
    text: "No method error is given for a ΔG° total; the figure is for ΔHf°.", ref: null, figure: null,
  }]);
});

test("a mixed total gets the figure for its enthalpy terms only", () => {
  assert.deepEqual(textOf(say([chosen(HYDROCARBON), chosen(A_VALUE)])),
    [LEAD, "The figure is for the ΔHf° terms only."]);
});

test("a nitrogen group is told the figure does not cover it", () => {
  assert.deepEqual(textOf(say([chosen(HYDROCARBON), chosen(NITROGEN)])),
    [LEAD, "The figure does not cover nitrogen."]);
  assert.deepEqual(textOf(say([chosen(NITROGEN), chosen(A_VALUE)])),
    [LEAD, "The figure is for the ΔHf° terms only.", "The figure does not cover nitrogen."]);
});

test("each element a figure was not measured on is named, and no other", () => {
  const carbonAndHydrogenOnly = uncertainty.map((figure) => ({ ...figure, elements: ["C", "H"] }));
  assert.deepEqual(textOf(say([chosen(HYDROCARBON), chosen(OXYGEN), chosen(NITROGEN)], carbonAndHydrogenOnly)),
    [LEAD, "The figure does not cover nitrogen or oxygen."]);
});

test("the chosen groups' own uncertainties are not added up into the figure (D11)", () => {
  // In quadrature, ten at 3 kJ/mol would read "about 9.5".
  assert.deepEqual(textOf(say([chosen({ ...HYDROCARBON, uncertainty: 3 }, 10)])), [LEAD]);
});

test("a total from a category that has not said what it holds is told nothing", () => {
  assert.equal(say([chosen(HYDROCARBON), { categoryFile: "99_Unknown.csv", count: 1, composition: { C: 1 } }]), null);
});

test("with no figure in the artifact there is nothing to say", () => {
  assert.equal(say([chosen(HYDROCARBON)], []), null);
});

test("a figure citing a reference the artifact does not hold is an error, not an unmarked sentence", () => {
  const uncited = uncertainty.map((figure) => ({ ...figure, ref: "Nobody2000" }));
  assert.throws(() => say([chosen(HYDROCARBON)], uncited), /cites 'Nobody2000'/);
});

test("every element a served group holds has a word to be written with", () => {
  const elements = new Set(rows.flatMap((row) => Object.keys(row.composition ?? {})));
  assert.deepEqual([...elements].filter((element) => !(element in ELEMENT_NAMES)), []);
});

test("loadArtifact hands back the references and the figures as the artifact holds them", async () => {
  const artifact = JSON.parse(await readFile(path.join(ROOT, "dist/increments.json"), "utf8"));
  assert.deepEqual(references, artifact.references);
  assert.deepEqual(uncertainty, artifact.uncertainty);
});

/* -------------------------------------------------------------------------- */
/* The table's Source column                                                    */
/* -------------------------------------------------------------------------- */

test("a row naming no Source of its own keeps its category's description, word for word", () => {
  assert.deepEqual(sourceOf(HYDROCARBON, references), { number: null, label: HYDROCARBON.category.source });
  assert.equal(HYDROCARBON.category.source, "Published Benson tables (pending final review)");
});

test("a row whose Source names a reference shows that reference's number", () => {
  assert.deepEqual(sourceOf({ ...HYDROCARBON, ref: "Cohen1996" }, references), { number: COHEN.number, label: null });
});

test("a row citing a reference the artifact does not hold is an error", () => {
  assert.throws(() => sourceOf({ ...HYDROCARBON, ref: "Nobody2000" }, references), /cites 'Nobody2000'/);
});

/* -------------------------------------------------------------------------- */
/* Totals                                                                       */
/* -------------------------------------------------------------------------- */

test("a total is given one decimal, whatever its parts claimed", () => {
  assert.equal(formatTotal(-284.07), `${MINUS}284.1`);
  assert.equal(formatTotal(2), "+2.0");
});

test("kcal takes two decimals, which is the same real precision", () => {
  assert.equal(formatKcal(-67.894), `${MINUS}67.89`);
});

/* -------------------------------------------------------------------------- */
/* What the total is a total of                                                 */
/* -------------------------------------------------------------------------- */

const CH = { file: "01_CH_Groups.csv", quantity: "standard enthalpy of formation", symbol: "ΔHf°" };
const A_VALUES = { file: "05_Cyclohexane_A_Values.csv", quantity: "conformational preference", symbol: "ΔG°" };
const declared = new Map([[CH.file, CH], [A_VALUES.file, A_VALUES]]);
const pick = (file, count = 1) => ({ categoryFile: file, count });

test("nothing chosen is an unlabelled total", () => {
  assert.equal(describeTotal([], declared).label, "Total");
});

test("one quantity throughout is named by its symbol", () => {
  const described = describeTotal([pick(CH.file, 5)], declared);
  assert.equal(described.label, "ΔHf°");
  assert.equal(described.mixed, false);
});

test("two different quantities are not claimed to be either one", () => {
  const described = describeTotal([pick(CH.file), pick(A_VALUES.file)], declared);
  assert.equal(described.label, "Total");
  assert.equal(described.mixed, true);
  assert.deepEqual(described.quantities.map((q) => q.symbol).sort(), ["ΔG°", "ΔHf°"]);
});

test("a mixed total counts how much of each quantity is in it", () => {
  const described = describeTotal([pick(CH.file, 6), pick(A_VALUES.file, 2)], declared);
  const bySymbol = Object.fromEntries(described.quantities.map((q) => [q.symbol, q.count]));
  assert.deepEqual(bySymbol, { "ΔHf°": 6, "ΔG°": 2 });
});

test("a category that has not declared its quantity leaves the total unlabelled", () => {
  // The metadata file is optional, so this is the ordinary state of a category
  // nobody has described yet - and inferring a heading for it would be a guess.
  assert.equal(describeTotal([pick("99_Unknown.csv")], declared).label, "Total");
  assert.equal(describeTotal([pick(CH.file), pick("99_Unknown.csv")], declared).label, "Total");
});

test("no metadata at all still produces a usable heading", () => {
  assert.equal(describeTotal([pick(CH.file)]).label, "Total");
});

/* -------------------------------------------------------------------------- */
/* Copying the working out                                                      */
/* -------------------------------------------------------------------------- */

const entry = (label, value, count, categoryFile = CH.file) =>
  ({ label, value, count, categoryFile });

test("nothing chosen copies as nothing", () => {
  assert.equal(formatSelectionAsText([], { totalKj: 0, kcal: 0, described: describeTotal([]) }), "");
});

test("copied text lines the values up in a column", () => {
  const entries = [entry("C-(C)(H)3", -42, 2), entry("C-(C)2(H)2", -20.9, 5)];
  const text = formatSelectionAsText(entries, {
    totalKj: -188.5, kcal: -45.05, described: describeTotal(entries, declared),
  });
  const lines = text.split("\n");
  assert.ok(lines[0].startsWith("C-(C)(H)3 x2"), "a repeated group says how many");
  // Right-aligned, so the values end in the same column rather than start there.
  assert.equal(lines[0].length, lines[1].length, "value columns should end flush");
  assert.ok(lines[0].endsWith("84.0") && lines[1].endsWith("104.5"));
});

test("copied text is headed by what the total is a total of", () => {
  const entries = [entry("C-(C)(H)3", -42, 1)];
  const text = formatSelectionAsText(entries, {
    totalKj: -42, kcal: -10.04, described: describeTotal(entries, declared),
  });
  assert.ok(text.includes("ΔHf°"), "the heading should carry the declared symbol");
  assert.ok(text.includes("kJ/mol") && text.includes("kcal/mol"), "both units are copied");
});

test("a mixed total carries its caveat into the copied text", () => {
  const entries = [entry("C-(C)(H)3", -42, 1), entry("OH", 3.43, 1, A_VALUES.file)];
  const text = formatSelectionAsText(entries, {
    totalKj: -38.57, kcal: -9.22, described: describeTotal(entries, declared),
  });
  assert.ok(text.includes("Mixes"), "the caveat must survive being copied out");
  assert.ok(text.includes("conformational preference"));
});
