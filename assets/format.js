/**
 * Turning values into the text on the page.
 *
 * Kept apart from the rendering, and free of the DOM, because how a number is
 * written is a decision worth testing: tools/format.test.mjs exercises it
 * directly. Nothing here changes an arithmetic result - the sums are done in
 * selection.js and are unaffected by any of this.
 *
 * Two rules run through the file.
 *
 * The first is that a number is shown to the precision the source actually
 * has. 195 of the 236 increments are written as plain integers, so rendering
 * them as `-42.00` claims two decimals Cohen & Benson never published. `-42`
 * is what the table says, so `-42` is what the page shows.
 *
 * The second is that an averaged range says so. Fifteen values are published
 * as a range - `2.51-4.35` for the OH A-value - and are averaged to a single
 * number for the total. That average is a fair thing to sum and a misleading
 * thing to print on its own, so the range is shown beside it.
 */

/** A real minus sign, not a hyphen: it aligns with digits in a tabular font. */
export const MINUS = "−";
/** An en dash separates a range; a hyphen would read as a minus. */
const RANGE_DASH = "–";

/** A signed number, using the typographic minus. Zero takes no sign. */
const withSign = (text, value) =>
  `${value > 0 ? "+" : value < 0 ? MINUS : ""}${text.replace(/^-/, "")}`;

/** Drop trailing zeros a rounding introduced: 3.430 is 3.43, 1.405 stays. */
const trimmed = (value, places) => Number(value.toFixed(places)).toString();

/**
 * One increment, at the precision its source claims.
 *
 * An averaged range is the exception: the midpoint of two two-decimal bounds
 * can need a third place (1.05-1.76 averages to 1.405), so it is given one
 * more than the source and then trimmed back if it turns out not to need it.
 */
export function formatIncrement(reading) {
  const text = reading.isRange
    ? trimmed(reading.value, reading.decimals + 1)
    : reading.value.toFixed(reading.decimals);
  return withSign(text, reading.value);
}

/** The published range itself, as the source wrote it. */
export function formatRange(reading) {
  if (!reading.isRange) return null;
  const places = reading.decimals;
  return `${reading.low.toFixed(places)}${RANGE_DASH}${reading.high.toFixed(places)}`;
}

/**
 * A running total, in kJ/mol.
 *
 * One decimal place, not two. The increments being summed are mostly whole
 * numbers, and the method's own agreement with experiment is a few kJ/mol, so
 * a second decimal is noise presented as precision.
 */
export const formatTotal = (kj) => withSign(kj.toFixed(1), kj);

/** The same total in kcal/mol. A kcal is about four times larger, so two
 *  decimals here is the same real precision as one decimal in kJ. */
export const formatKcal = (kcal) => withSign(kcal.toFixed(2), kcal);

/**
 * How far a total could move if every averaged range were read at its bounds.
 *
 * Half the width of each range, times how many of it were chosen. Zero when
 * nothing chosen was published as a range, which is the usual case.
 */
export function rangeSpread(entries) {
  return entries.reduce(
    (total, entry) => total + (entry.isRange ? ((entry.high - entry.low) / 2) * entry.count : 0),
    0,
  );
}

/**
 * What the running total is a total *of*.
 *
 * The categories do not all hold the same physical quantity: a Benson group
 * increment is a standard enthalpy of formation, while a cyclohexane A-value
 * is a conformational free-energy preference. Both belong in this tool and
 * both are summed - that is settled - but a heading that reads
 * "Estimated dHf" over a sum containing an A-value would state something
 * untrue, so the heading follows what was actually chosen.
 *
 * The quantity of a category is declared in CSV_data_files/categories.csv and
 * is optional, so `symbol` may be missing. When it is, the honest answer is
 * the unlabelled total rather than a guess: a category that has not said what
 * it holds cannot have its heading inferred.
 */
export function describeTotal(entries, categoriesByFile = new Map()) {
  const fallback = { label: "Total", quantities: [], mixed: false };
  if (!entries.length) return fallback;

  const seen = new Map();
  for (const entry of entries) {
    const category = categoriesByFile.get(entry.categoryFile);
    if (!category?.symbol || !category?.quantity) return fallback;
    if (!seen.has(category.symbol)) {
      seen.set(category.symbol, { ...category, count: 0 });
    }
    seen.get(category.symbol).count += entry.count;
  }

  const quantities = [...seen.values()];
  if (quantities.length === 1) {
    return { label: quantities[0].symbol, quantities, mixed: false };
  }

  // More than one quantity in the sum. Name the total plainly and let the page
  // list what is in it, rather than claiming it is any one of them.
  return { label: "Total", quantities, mixed: true };
}

/**
 * The chosen increments as plain text, for pasting into a report.
 *
 * Laid out as a column so the values line up when it lands in a monospaced
 * box, and headed by whatever describeTotal() concluded the sum is - including
 * the note when it is a sum of more than one quantity, because that caveat
 * should survive being copied out of the page.
 */
export function formatSelectionAsText(entries, { totalKj, kcal, described }) {
  if (!entries.length) return "";

  const names = entries.map((entry) => entry.label + (entry.count > 1 ? ` x${entry.count}` : ""));
  const sums = entries.map((entry) => formatTotal(entry.value * entry.count));
  const nameWidth = Math.max(...names.map((name) => name.length), 8);
  const sumWidth = Math.max(...sums.map((sum) => sum.length), 8);

  const lines = names.map((name, i) => `${name.padEnd(nameWidth)}  ${sums[i].padStart(sumWidth)}`);
  lines.push("-".repeat(nameWidth + 2 + sumWidth));
  lines.push(`${described.label.padEnd(nameWidth)}  ${formatTotal(totalKj).padStart(sumWidth)} kJ/mol`);
  lines.push(`${"".padEnd(nameWidth)}  ${formatKcal(kcal).padStart(sumWidth)} kcal/mol`);

  if (described.mixed) {
    lines.push("");
    lines.push("Mixes " + described.quantities
      .map((quantity) => `${quantity.count} x ${quantity.quantity}`)
      .join(", ") + ".");
  }
  return lines.join("\n");
}
