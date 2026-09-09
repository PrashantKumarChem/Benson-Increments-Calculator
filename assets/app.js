/**
 * Benson Increments Calculator - user interface.
 *
 * All chemistry data handling lives in benson.js; this file only turns that
 * data into a page and keeps the selection in sync with what is displayed.
 */
import { KJ_TO_KCAL, fetchText, loadCategories } from "./benson.js";
import { countsByCategory, sectionsFor, toggleFilter, visibleRows } from "./browse.js";
import { formatIncrement, formatKcal, formatRange, formatTotal, rangeSpread } from "./format.js";
import { buildIndex, emptyNotation, loadNotation } from "./notation.js";
import { createSelection, keyOf } from "./selection.js";

/** The increments chosen so far; see selection.js for the rules it enforces. */
const selection = createSelection();

const el = (id) => document.getElementById(id);

const escapeHtml = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Render trailing digits as subscripts so C-(C)2(H)2 reads like printed notation. */
const asFormula = (name) => escapeHtml(name).replace(/([A-Za-z)\]])(\d+)/g, "$1<sub>$2</sub>");

/** A card's value, plus the published range when the value is an average of one. */
function valueHtml(reading) {
  const range = formatRange(reading);
  return `${escapeHtml(formatIncrement(reading))}` +
    (range ? ` <span class="range" title="published range">${escapeHtml(range)}</span>` : "");
}

/* -------------------------------------------------------------------------- */
/* View                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * What is on screen. `files` is the set of categories the chips have narrowed
 * to; empty means all of them, since the chips narrow a complete list rather
 * than building one up. See browse.js for the rules themselves.
 */
const view = { categories: [], notation: emptyNotation(), index: [], files: new Set(), query: "" };

/** One increment, as a card. */
function cardHtml(increment, counts) {
  const { label, category, matchedSynonym } = increment;
  const count = counts.get(keyOf(category.file, label)) ?? 0;
  // While searching the section headings are gone, so a result has to say
  // where it came from - and says it in the student's own words when that is
  // what they typed, so finding C-(C)(H)3 under "methyl" teaches the notation
  // rather than merely producing it.
  const context = view.query
    ? ` &middot; ${escapeHtml(matchedSynonym ?? category.title)}`
    : "";
  const tally = count ? ` <span class="tally">&times; ${count}</span>` : "";
  const hover = `${label} — ${increment.source} kJ/mol` +
    (increment.isRange ? " (published as a range; the average is used)" : "");
  return `<button data-file="${escapeHtml(category.file)}" data-label="${escapeHtml(label)}"
            class="${count ? "picked" : ""}" title="${escapeHtml(hover)}">
            <span>${asFormula(label)}</span>
            <span class="meta">${valueHtml(increment)}${context}${tally}</span>
          </button>`;
}

/**
 * The category filter.
 *
 * "All" is not a sixth category but the absence of a filter, which is why it
 * reads as chosen exactly when nothing else is. Counts follow the search, so a
 * chip never claims 82 next to three matches.
 */
function renderChips() {
  const visible = countsByCategory(visibleRows(view.index, { query: view.query }));
  const total = [...visible.values()].reduce((sum, n) => sum + n, 0);

  const chip = (file, title, count, pressed) =>
    `<button class="chip" data-file="${escapeHtml(file)}" aria-pressed="${pressed}">` +
    `${escapeHtml(title)}<span class="n">${count}</span></button>`;

  el("chips").innerHTML = [
    chip("", "All", total, view.files.size === 0),
    ...view.categories.map((category) =>
      chip(category.file, category.title, visible.get(category.file) ?? 0,
        view.files.has(category.file))),
  ].join("");
}

function renderLibrary() {
  const counts = selection.countsByKey();
  const rows = visibleRows(view.index, { query: view.query, files: view.files });
  const sections = sectionsFor(rows, { query: view.query });

  if (!sections.length) {
    el("library").innerHTML =
      `<p class="status">No group matches &ldquo;${escapeHtml(view.query)}&rdquo;.</p>`;
    return;
  }

  el("library").innerHTML = sections
    .map((section) => {
      // A search is ordered by relevance rather than by file, so it gets one
      // heading describing the result instead of a heading per category.
      const heading = section.category
        ? `${escapeHtml(section.category.title)}<span class="n">${section.rows.length}</span>`
        : `${section.rows.length} ${section.rows.length === 1 ? "match" : "matches"}` +
          `<span class="n">best first</span>`;
      return `<h2 class="section-head">${heading}</h2>` +
        `<div class="grid">${section.rows.map((row) => cardHtml(row, counts)).join("")}</div>`;
    })
    .join("");
}

function renderTally() {
  const totalKj = selection.totalKj;
  const entries = selection.entries;
  el("kj").innerHTML = `${escapeHtml(formatTotal(totalKj))}<span>kJ/mol</span>`;
  el("kcal").textContent = `${formatKcal(totalKj * KJ_TO_KCAL)} kcal/mol`;

  // An averaged range is a soft number, and how soft is worth saying: this is
  // how far the total would move if every one of them were read at its bounds.
  const spread = rangeSpread(entries);
  const ranged = entries.filter((entry) => entry.isRange).length;
  const band = el("band");
  band.hidden = ranged === 0;
  if (ranged) {
    band.innerHTML =
      `${ranged} ${ranged === 1 ? "value is" : "values are"} published as a range. ` +
      `Across the full range the total runs ` +
      `<b>${escapeHtml(formatTotal(totalKj - spread))}</b> to ` +
      `<b>${escapeHtml(formatTotal(totalKj + spread))}</b> kJ/mol.`;
  }

  const isEmpty = selection.isEmpty;
  // The panel keeps the total on screen either way, but stops reserving a
  // column it has nothing to put in. Stated as an attribute rather than left
  // to a :has() selector, so what drives the layout is visible in one place.
  el("layout").dataset.tally = isEmpty ? "empty" : "filled";
  el("empty").hidden = !isEmpty;
  el("undo").disabled = isEmpty;
  el("reset").disabled = isEmpty;

  el("picks").innerHTML = entries
    .map((entry) => `
      <li>
        <span class="name">${asFormula(entry.label)}
          <span class="each">${escapeHtml(entry.categoryTitle)} &middot; ${
            entry.isRange
              ? `midpoint of ${escapeHtml(formatRange(entry))}`
              : escapeHtml(formatIncrement(entry))
          }</span>
        </span>
        <span class="stepper">
          <button data-step="-1" data-key="${escapeHtml(entry.key)}" aria-label="One fewer ${escapeHtml(entry.label)}">&minus;</button>
          <span class="n">${entry.count}</span>
          <button data-step="1" data-key="${escapeHtml(entry.key)}" aria-label="One more ${escapeHtml(entry.label)}">+</button>
        </span>
        <span class="sum">${escapeHtml(formatTotal(entry.value * entry.count))}</span>
        <button class="rm" data-remove="${escapeHtml(entry.key)}" aria-label="Remove ${escapeHtml(entry.label)}">&times;</button>
      </li>`)
    .join("");
}

function render() {
  renderChips();
  renderLibrary();
  renderTally();
}

function setQuery(query) {
  view.query = query.trim();
  el("clear").hidden = !view.query;
  render();
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

el("chips").addEventListener("click", (event) => {
  const chip = event.target.closest("button[data-file]");
  if (!chip) return;
  // The "All" chip carries no file: choosing it clears the filter rather than
  // selecting a category, which is what "no filter" means here.
  view.files = chip.dataset.file ? toggleFilter(view.files, chip.dataset.file) : new Set();
  render();
});

el("about-toggle").addEventListener("click", (event) => {
  const open = el("about").hidden;
  el("about").hidden = !open;
  event.currentTarget.setAttribute("aria-expanded", String(open));
});

el("library").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-label]");
  if (!button) return;

  const category = view.categories.find((candidate) => candidate.file === button.dataset.file);
  const row = category?.rows.find((candidate) => candidate.label === button.dataset.label);
  if (!row) return;

  selection.add({ ...row, categoryFile: category.file, categoryTitle: category.title });
  render();
});

el("picks").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.remove) selection.remove(button.dataset.remove);
  else if (button.dataset.step) selection.step(button.dataset.key, Number(button.dataset.step));
  else return;

  render();
});

el("filter").addEventListener("input", (event) => setQuery(event.target.value));

el("clear").addEventListener("click", () => {
  el("filter").value = "";
  setQuery("");
  el("filter").focus();
});

el("undo").addEventListener("click", () => {
  selection.undo();
  render();
});

el("reset").addEventListener("click", () => {
  selection.clear();
  render();
});

/* -------------------------------------------------------------------------- */
/* Start                                                                       */
/* -------------------------------------------------------------------------- */

const REPO_URL = "https://github.com/PrashantKumarChem/Benson-Increments-Calculator";

try {
  view.categories = await loadCategories({ readText: fetchText });

  // The increments are the calculator; the notation files only let a group be
  // found by the shorthand a student writes. If they cannot be read the sums
  // must still work, so this is reported and stepped over rather than thrown -
  // searching then falls back to the names as printed, by the same code path.
  try {
    view.notation = await loadNotation({ readText: fetchText });
  } catch (error) {
    view.notation = emptyNotation();
    console.warn(`notation/ could not be read, so a group is only findable by its printed name: ${error.message}`);
  }
  view.index = buildIndex(view.categories, view.notation);

  const total = view.categories.reduce((sum, category) => sum + category.rows.length, 0);
  const unreadable = view.categories.flatMap((category) =>
    category.problems.map((problem) => `${category.file}:${problem.line} (${problem.reason})`));

  el("footer").innerHTML =
    `${total} increments across ${view.categories.length} categories, read from the ` +
    `project&rsquo;s CSV files. <a href="${REPO_URL}">Source and data on GitHub</a> &middot; GPL-3.0.` +
    (unreadable.length
      ? `<br><strong>${unreadable.length} row(s) could not be read:</strong> ${escapeHtml(unreadable.join(", "))}`
      : "");

  render();
} catch (error) {
  el("library").innerHTML =
    `<p class="status">Could not load the increment data: ${escapeHtml(error.message)}.<br>
     If you opened this file straight from disk, serve the folder instead — for example
     <code>python -m http.server</code> — so the browser is allowed to read the CSV files.</p>`;
}
