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

import { loadCategories, readValue } from "../assets/benson.js";
import {
  MINUS,
  describeTotal,
  formatIncrement,
  formatKcal,
  formatRange,
  formatSelectionAsText,
  formatTotal,
  rangeSpread,
} from "../assets/format.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const categories = await loadCategories({
  readText: (relative) => readFile(path.join(ROOT, relative), "utf8"),
});
const rows = categories.flatMap((category) => category.rows);
const find = (label) => rows.find((row) => row.label === label);

/* -------------------------------------------------------------------------- */
/* Precision                                                                    */
/* -------------------------------------------------------------------------- */

test("a whole number is shown as one, not padded to two decimals", () => {
  assert.equal(formatIncrement(readValue("-42")), `${MINUS}42`);
  assert.equal(formatIncrement(readValue("118")), "+118");
});

test("a source with one decimal keeps exactly one", () => {
  assert.equal(formatIncrement(readValue("-20.9")), `${MINUS}20.9`);
  assert.equal(formatIncrement(readValue("13.8")), "+13.8");
});

test("a source with two decimals keeps exactly two", () => {
  assert.equal(formatIncrement(readValue("0.03")), "+0.03");
});

test("zero carries no sign", () => {
  assert.equal(formatIncrement(readValue("0")), "0");
});

test("the minus shown is a real minus sign, not a hyphen", () => {
  assert.ok(formatIncrement(readValue("-7")).startsWith(MINUS));
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
  assert.equal(formatRange(readValue("-42")), null);
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
