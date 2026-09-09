/**
 * Benson Increments Calculator - user interface.
 *
 * All chemistry data handling lives in benson.js; this file only turns that
 * data into a page and keeps the selection in sync with what is displayed.
 */
import { KJ_TO_KCAL, fetchText, loadCategories } from "./benson.js";
import { countsByCategory, sectionsFor, toggleFilter, visibleRows } from "./browse.js";
import {
  describeTotal, formatIncrement, formatKcal, formatRange, formatSelectionAsText,
  formatTotal, rangeSpread,
} from "./format.js";
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
const view = {
  categories: [], notation: emptyNotation(), index: [],
  /** Categories by filename, for looking up what a chosen increment is a measure of. */
  byFile: new Map(),
  files: new Set(), query: "",
  /** "cards" to scan by shape, "table" to compare values and read provenance. */
  mode: "cards",
};

/** One increment, as a card. */
function cardHtml(increment, counts) {
  const { label, category, matchedSynonym } = increment;
  const count = counts.get(keyOf(category.file, label)) ?? 0;
  // While searching the section headings are gone, so a result has to say
  // where it came from - and says it in the student's own words when that is
  // what they typed, so finding C-(C)(H)3 under "methyl" teaches the notation
  // rather than merely producing it.
  const context = view.query
    ? `<span class="from">&middot; ${escapeHtml(matchedSynonym ?? category.title)}</span>`
    : "";
  // How many are chosen, as a badge rather than as more text in the value line,
  // where it was read as part of the number. The badge is also where you take
  // one back: a card cannot hold a nested button, so it stays a span and the
  // listener reads which part of the card was pressed.
  const tally = count
    ? `<span class="tally" data-step-down title="Remove one">&times;${count}</span>`
    : "";
  const hover = `${label} — ${increment.source} kJ/mol` +
    (increment.isRange ? " (published as a range; the average is used)" : "") +
    (count ? " · press the count to remove one" : "");
  return `<button data-file="${escapeHtml(category.file)}" data-label="${escapeHtml(label)}"
            class="${count ? "picked" : ""}" title="${escapeHtml(hover)}">
            <span class="name">${asFormula(label)}</span>
            <span class="meta">${valueHtml(increment)}${context}${tally}</span>
          </button>`;
}

/**
 * One increment, as a table row.
 *
 * The table is where a category's own description earns its place: the same
 * value, said to come from somewhere and to measure something. Where a
 * category has declared nothing the cells are an em dash rather than a guess.
 */
function rowHtml(increment, counts) {
  const { label, category } = increment;
  const count = counts.get(keyOf(category.file, label)) ?? 0;
  const or = (text) => escapeHtml(text || "\u2014");
  return `<tr class="${count ? "picked" : ""}">
      <th scope="row"><button data-file="${escapeHtml(category.file)}" data-label="${escapeHtml(label)}"
        >${asFormula(label)}</button>${count
          ? `<button class="tally" data-step-down
               data-file="${escapeHtml(category.file)}" data-label="${escapeHtml(label)}"
               aria-label="Remove one ${escapeHtml(label)}">&times;${count}</button>`
          : ""}</th>
      <td class="num">${escapeHtml(formatIncrement(increment))}</td>
      <td class="num soft">${increment.isRange ? escapeHtml(formatRange(increment)) : "&mdash;"}</td>
      <td class="soft">${or(category.unit)}</td>
      <td class="soft">${or(category.quantity)}</td>
      <td class="soft">${or(category.source)}</td>
    </tr>`;
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
      const body = view.mode === "table"
        ? `<div class="table-wrap"><table class="table">
             <thead><tr>
               <th scope="col">Group</th>
               <th scope="col" class="num">Value</th>
               <th scope="col" class="num">Published range</th>
               <th scope="col">Unit</th>
               <th scope="col">Quantity</th>
               <th scope="col">Source</th>
             </tr></thead>
             <tbody>${section.rows.map((row) => rowHtml(row, counts)).join("")}</tbody>
           </table></div>`
        : `<div class="grid">${section.rows.map((row) => cardHtml(row, counts)).join("")}</div>`;
      return `<h2 class="section-head">${heading}</h2>${body}`;
    })
    .join("");
}

function renderTally() {
  const totalKj = selection.totalKj;
  const entries = selection.entries;
  el("kj").innerHTML = `${escapeHtml(formatTotal(totalKj))}<span>kJ/mol</span>`;
  // The unit is written as its own element, as it is on the kJ line above:
  // set as one string it inherited the figure's monospace and read as code.
  el("kcal").innerHTML =
    `${escapeHtml(formatKcal(totalKj * KJ_TO_KCAL))}<span>kcal/mol</span>`;

  // What the total is a total of. The categories do not all hold the same
  // quantity - a group increment is an enthalpy of formation, a cyclohexane
  // A-value is a conformational preference - so a heading reading dHf over a
  // sum containing an A-value would state something untrue. Both are summed,
  // which is settled; only the heading follows what was actually chosen.
  const described = describeTotal(entries, view.byFile);
  el("tally-label").textContent = described.label;

  // A mixed total names what is in it rather than claiming to be any one of
  // them. The wording comes from the data: each category says what it holds.
  const mixed = el("mixed");
  mixed.hidden = !described.mixed;
  if (described.mixed) {
    const parts = described.quantities
      .map((quantity) => `${quantity.count} &times; <b>${escapeHtml(quantity.quantity)}</b>`)
      .join(", ");
    mixed.innerHTML = `This total mixes ${parts}. They are summed as published, ` +
      "but they are not the same quantity.";
  }

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
  // The list is headed only once it has something in it: a heading over an
  // empty list is a promise the panel is not yet keeping.
  el("picks-head").hidden = isEmpty;
  // On a phone the body is folded away, so the button has to say what is in
  // it - "Details" tells you nothing you could not already see.
  el("panel-toggle-text").textContent = isEmpty
    ? "Details"
    : `${entries.length} ${entries.length === 1 ? "term" : "terms"}`;
  el("undo").disabled = isEmpty;
  el("copy").disabled = isEmpty;
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

el("views").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-mode]");
  if (!button) return;
  view.mode = button.dataset.mode;
  for (const other of event.currentTarget.children) {
    other.setAttribute("aria-pressed", String(other === button));
  }
  renderLibrary();
});

/**
 * The panel's disclosure, which only exists on a small screen.
 *
 * Beside the grid the panel is one block and the button is not rendered, so
 * this listener is harmless there: nothing can press what has no box.
 */
function setPanelOpen(open) {
  el("tally-panel").dataset.open = String(open);
  el("panel-toggle").setAttribute("aria-expanded", String(open));
}

el("panel-toggle").addEventListener("click", () => {
  setPanelOpen(el("tally-panel").dataset.open !== "true");
});

/**
 * Swipe the sheet open and shut.
 *
 * The one gesture worth having here, because it is the one that cannot go
 * wrong: it moves no number. A mis-swipe that adds or removes an increment
 * changes someone's answer without saying so, which is the failure this whole
 * project is arranged to avoid - so adding and removing stay on buttons you
 * can see, and the gesture is limited to how much of the panel is showing.
 *
 * It listens on the panel but ignores anything starting inside the body, which
 * is a scrolling region: dragging a list of contributions should scroll the
 * list. The threshold is what tells a swipe from a twitch.
 *
 * Nothing is prevented here, and it does not need to be: the handle and the
 * head carry touch-action: none, so the browser never starts a pan from them
 * in the first place. Doing it in the stylesheet rather than with
 * preventDefault is what lets these stay passive listeners, and it is also
 * what fixed the gesture on real hardware - the browser used to claim the same
 * downward swipe, scrolling the page under the finger and, at the top of the
 * document, reloading it as pull-to-refresh with every increment in it.
 */
const SWIPE = 40;

el("tally-panel").addEventListener("touchstart", (event) => {
  const panel = event.currentTarget;
  panel.dataset.swipeFrom =
    event.target.closest(".tally-body") ? "" : String(event.touches[0].clientY);
}, { passive: true });

el("tally-panel").addEventListener("touchend", (event) => {
  const from = event.currentTarget.dataset.swipeFrom;
  event.currentTarget.dataset.swipeFrom = "";
  if (!from) return;

  const travelled = event.changedTouches[0].clientY - Number(from);
  if (Math.abs(travelled) < SWIPE) return;
  setPanelOpen(travelled < 0);
}, { passive: true });

el("about-toggle").addEventListener("click", (event) => {
  const open = el("about").hidden;
  el("about").hidden = !open;
  event.currentTarget.setAttribute("aria-expanded", String(open));
});

/** Add one of the increment named by a category file and a label. */
function addIncrement(file, label) {
  const category = view.byFile.get(file);
  const row = category?.rows.find((candidate) => candidate.label === label);
  if (!row) return;
  selection.add({ ...row, categoryFile: category.file, categoryTitle: category.title });
}

el("library").addEventListener("click", (event) => {
  // Taking one back, before adding one: on a card the badge is a span inside
  // the button, so both would match the add below. In the table it is a button
  // of its own. Either way the file and label come from the nearest element
  // carrying them, which is the badge itself in the table and the card around
  // it in the grid.
  const stepDown = event.target.closest("[data-step-down]");
  if (stepDown) {
    const owner = stepDown.closest("[data-file]");
    selection.step(keyOf(owner.dataset.file, owner.dataset.label), -1);
    render();
    return;
  }

  const button = event.target.closest("button[data-label]");
  if (!button) return;
  addIncrement(button.dataset.file, button.dataset.label);
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

/**
 * Copy the working out, not just the answer.
 *
 * What a student does next with a total is paste it into a report, and the
 * total on its own does not show which groups produced it. The caveat about
 * mixed quantities goes too, because a warning that does not survive being
 * copied is not much of a warning.
 */
el("copy").addEventListener("click", async (event) => {
  const totalKj = selection.totalKj;
  const text = formatSelectionAsText(selection.entries, {
    totalKj,
    kcal: totalKj * KJ_TO_KCAL,
    described: describeTotal(selection.entries, view.byFile),
  });

  const button = event.currentTarget;
  const said = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    // Some browsers refuse the clipboard outside a secure context. Say so
    // rather than appearing to have worked.
    button.textContent = "Cannot copy";
  }
  setTimeout(() => { button.textContent = said; }, 1500);
});

/**
 * The keyboard path.
 *
 * Someone working through a molecule adds a dozen increments, and reaching for
 * the mouse for each one is the slow part. Ctrl+K (Cmd+K on a Mac) puts the
 * cursor in the search box from anywhere; the arrow keys walk the increments;
 * Enter adds the focused one, which buttons already do; and + and - adjust it
 * without leaving the keyboard.
 *
 * Re-rendering replaces the button that had focus, so the position is restored
 * afterwards rather than the focus being allowed to fall back to the body.
 */
function focusableIncrements() {
  return [...el("library").querySelectorAll("button[data-label]")];
}

addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    el("filter").focus();
    el("filter").select();
    return;
  }

  const current = document.activeElement;
  if (!current?.matches?.("#library button[data-label]")) return;

  const buttons = focusableIncrements();
  const here = buttons.indexOf(current);
  if (here < 0) return;

  // How many share a row, so up and down move by a row rather than by one.
  // In the table that is one per row, which falls out of the same measurement.
  const topOf = (button) => Math.round(button.getBoundingClientRect().top);
  const firstRowTop = topOf(buttons[0]);
  const perRow = Math.max(1, buttons.filter((button) => topOf(button) === firstRowTop).length);

  const moveTo = (index) => {
    const target = buttons[index];
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  const adjust = (delta) => {
    event.preventDefault();
    const key = keyOf(current.dataset.file, current.dataset.label);
    if (delta > 0) addIncrement(current.dataset.file, current.dataset.label);
    else selection.step(key, -1);
    render();
    focusableIncrements()[here]?.focus();
  };

  switch (event.key) {
    case "ArrowRight": moveTo(here + 1); break;
    case "ArrowLeft": moveTo(here - 1); break;
    case "ArrowDown": moveTo(here + perRow); break;
    case "ArrowUp": moveTo(here - perRow); break;
    case "+": case "=": adjust(1); break;
    case "-": adjust(-1); break;
    default: break;
  }
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
  view.byFile = new Map(view.categories.map((category) => [category.file, category]));

  const total = view.categories.reduce((sum, category) => sum + category.rows.length, 0);
  const unreadable = view.categories.flatMap((category) =>
    category.problems.map((problem) => `${category.file}:${problem.line} (${problem.reason})`));

  el("footer").innerHTML =
    `${total} increments across ${view.categories.length} categories, read from the ` +
    `project&rsquo;s CSV files. <a href="${REPO_URL}">Source and data on GitHub</a> &middot; GPL-3.0.` +
    (unreadable.length
      ? `<br><strong>${unreadable.length} row(s) could not be read:</strong> ${escapeHtml(unreadable.join(", "))}`
      : "");

  // Say Cmd where that is the key, so the hint is not wrong on half the class.
  if (/Mac|iPhone|iPad/i.test(navigator.platform ?? "")) el("shortcut").textContent = "\u2318 K";

  render();
} catch (error) {
  el("library").innerHTML =
    `<p class="status">Could not load the increment data: ${escapeHtml(error.message)}.<br>
     If you opened this file straight from disk, serve the folder instead — for example
     <code>python -m http.server</code> — so the browser is allowed to read the CSV files.</p>`;
}
