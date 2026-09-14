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
 * The method's own uncertainty on a total, given the individual increments
 * it is built from.
 *
 * `individualUncertainties` is accepted and deliberately not summed. Ten
 * groups at ±3 kJ/mol would give ±9.5 in quadrature, nearly double the 5.5
 * kJ/mol average error Cohen reports - the group values were fitted to
 * minimise whole-molecule residuals, so their errors are anticorrelated by
 * construction, and naive propagation overestimates (D11). The empirical
 * figure is what is displayed, supplied as `methodFigure` rather than
 * computed here, because which figure that is stays a chemistry judgement
 * this function does not make.
 */
export function combinedUncertainty(individualUncertainties, methodFigure) {
  return methodFigure;
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
 * The quantity of a category is declared in notation/categories.csv, and
 * carried on the artifact's own category entries; it is optional, so `symbol`
 * may be missing. When it is, the honest answer is the unlabelled total rather
 * than a guess: a category that has not said what it holds cannot have its
 * heading inferred.
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
 * Element symbols as words, for the one sentence that names an element.
 *
 * Which elements a figure was measured on is data (data/uncertainty.csv), and
 * so is every group's composition; only the word for a symbol lives here. A
 * symbol with no word is printed as the symbol rather than guessed at, and
 * tools/format.test.mjs fails if the artifact holds an element this leaves
 * unnamed.
 */
export const ELEMENT_NAMES = { C: "carbon", H: "hydrogen", N: "nitrogen", O: "oxygen" };

/** "nitrogen", "nitrogen or oxygen", "carbon, nitrogen or oxygen". */
const orList = (words) =>
  words.length > 1 ? `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}` : words.join("");

/**
 * What to say about the method's own uncertainty, under a total.
 *
 * `figures` is the artifact's `uncertainty` list - for each quantity symbol, a
 * published figure for the method's error on a whole total, with the phase and
 * the elements it was measured on - and `references` is the artifact's own
 * list, so a sentence can carry its citation's number.
 *
 * The figure is shown as published and never built up from the chosen groups'
 * own uncertainties. combinedUncertainty() is what says so (D11), and it is
 * asked here rather than restated. What this decides is where the figure
 * applies, because a method error printed under a total it was never measured
 * on is a confident wrong statement:
 *
 *   - nothing chosen, no figure at all, or a category that has not said what
 *     it holds: nothing is claimed, as describeTotal() declines to label it;
 *   - no quantity in the total has a figure: say so, and what the figure is for;
 *   - a total that mixes quantities: the figure, and that it is for its own
 *     quantity's terms only;
 *   - a chosen group holding an element the figure was not measured on: the
 *     figure, and that it does not cover that element.
 *
 * This is apart from rangeSpread() on purpose (D12): that is how far the
 * published ranges move this total, and this is how far the method typically
 * misses. Two questions, two lines.
 *
 * Returns null, or `{ sentences }` where each is `{ text, ref, figure }`: plain
 * text, the number of the reference it cites or null, and the index in
 * `figures` of the figure whose note explains it or null. app.js escapes the
 * text and sets the number as a superscript.
 */
export function describeMethodUncertainty(entries, categoriesByFile, figures, references) {
  if (!figures.length) return null;
  // describeTotal() names no quantity for an empty selection either.
  const described = describeTotal(entries, categoriesByFile);
  if (!described.quantities.length) return null;

  const withFigure = described.quantities
    .map((quantity) => ({ quantity, index: figures.findIndex((figure) => figure.symbol === quantity.symbol) }))
    .filter(({ index }) => index >= 0);
  if (!withFigure.length) {
    return {
      sentences: [{
        text: `No method error is given for a ${orList(described.quantities.map((q) => q.symbol))} total; ` +
          `the figure is for ${orList(figures.map((figure) => figure.symbol))}.`,
        ref: null,
        figure: null,
      }],
    };
  }

  const sentences = [];
  for (const { quantity, index } of withFigure) {
    const figure = figures[index];
    const reference = references.find((candidate) => candidate.key === figure.ref);
    if (!reference) {
      // benson/build.py refuses to write this, so reaching it means the page
      // is reading an artifact it was not built with.
      throw new Error(`the ${figure.symbol} uncertainty figure cites '${figure.ref}', ` +
        "which is not in the artifact's references");
    }
    const terms = entries.filter((entry) => categoriesByFile.get(entry.categoryFile)?.symbol === quantity.symbol);
    // Each group's own published uncertainty, once for every time it was
    // chosen: handed over, and not summed.
    const own = terms.flatMap((entry) => Array(entry.count).fill(entry.uncertainty))
      .filter((uncertainty) => uncertainty != null);
    const value = combinedUncertainty(own, figure.value);
    sentences.push({
      text: `Benson estimates of ${figure.phase}-phase ${figure.symbol} are typically off by about ` +
        `${value.toFixed(figure.decimals)} kJ/mol.`,
      ref: reference.number,
      figure: index,
    });
    if (described.mixed) {
      sentences.push({ text: `The figure is for the ${figure.symbol} terms only.`, ref: null, figure: null });
    }
    const outside = [...new Set(terms.flatMap((entry) => Object.keys(entry.composition ?? {})))]
      .filter((element) => !figure.elements.includes(element))
      .sort();
    if (outside.length) {
      sentences.push({
        text: `The figure does not cover ${orList(outside.map((element) => ELEMENT_NAMES[element] ?? element))}.`,
        ref: null,
        figure: null,
      });
    }
  }
  return { sentences };
}

/**
 * What a table row shows under Source.
 *
 * A row whose Source names a reference shows that reference's number, which
 * the page links to the list at its foot. A row with none keeps its category's
 * own description word for word: until each row records its source, that is
 * what says where the category's values come from.
 */
export function sourceOf(increment, references) {
  if (!increment.ref) return { number: null, label: increment.category?.source ?? "" };
  const reference = references.find((candidate) => candidate.key === increment.ref);
  if (!reference) {
    throw new Error(`'${increment.label}' cites '${increment.ref}', which is not in the artifact's references`);
  }
  return { number: reference.number, label: null };
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
