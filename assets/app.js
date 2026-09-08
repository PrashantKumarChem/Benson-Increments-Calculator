/**
 * Benson Increments Calculator - user interface.
 *
 * All chemistry data handling lives in benson.js; this file only turns that
 * data into a page and keeps the selection in sync with what is displayed.
 */
import { KJ_TO_KCAL, fetchText, loadCategories } from "./benson.js";
import { createSelection, keyOf } from "./selection.js";

/** The increments chosen so far; see selection.js for the rules it enforces. */
const selection = createSelection();

const el = (id) => document.getElementById(id);

const escapeHtml = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Render trailing digits as subscripts so C-(C)2(H)2 reads like printed notation. */
const asFormula = (name) => escapeHtml(name).replace(/([A-Za-z)\]])(\d+)/g, "$1<sub>$2</sub>");

const signed = (value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

/* -------------------------------------------------------------------------- */
/* View                                                                        */
/* -------------------------------------------------------------------------- */

const view = { categories: [], activeTab: 0, query: "" };

/** Increments to show: the active tab, or matches from every category while searching. */
function visibleIncrements() {
  const query = view.query.toLowerCase();

  if (!query) {
    const category = view.categories[view.activeTab];
    return category ? category.rows.map((row) => ({ ...row, category })) : [];
  }

  return view.categories.flatMap((category) =>
    category.rows
      .filter((row) => row.label.toLowerCase().includes(query))
      .map((row) => ({ ...row, category })));
}

function renderTabs() {
  el("tabs").innerHTML = view.categories
    .map((category, index) =>
      `<button role="tab" aria-selected="${!view.query && index === view.activeTab}" data-tab="${index}">` +
      `${escapeHtml(category.title)}<span class="n">${category.rows.length}</span></button>`)
    .join("");
}

function renderGrid() {
  const counts = selection.countsByKey();
  const increments = visibleIncrements();

  if (!increments.length) {
    el("grid").innerHTML =
      `<p class="status">No group matches &ldquo;${escapeHtml(view.query)}&rdquo;.</p>`;
    return;
  }

  el("grid").innerHTML = increments
    .map(({ label, value, category }) => {
      const count = counts.get(keyOf(category.file, label)) ?? 0;
      const context = view.query ? ` &middot; ${escapeHtml(category.title)}` : "";
      const tally = count ? ` <span class="tally">&times; ${count}</span>` : "";
      return `<button data-file="${escapeHtml(category.file)}" data-label="${escapeHtml(label)}"
                class="${count ? "picked" : ""}" title="${escapeHtml(label)} — ${value.toFixed(2)} kJ/mol">
                <span>${asFormula(label)}</span>
                <span class="meta">${signed(value)}${context}${tally}</span>
              </button>`;
    })
    .join("");
}

function renderTally() {
  const totalKj = selection.totalKj;
  el("kj").innerHTML = `${totalKj.toFixed(2)}<span>kJ/mol</span>`;
  el("kcal").textContent = `${(totalKj * KJ_TO_KCAL).toFixed(2)} kcal/mol`;

  const isEmpty = selection.isEmpty;
  el("empty").hidden = !isEmpty;
  el("undo").disabled = isEmpty;
  el("reset").disabled = isEmpty;

  el("picks").innerHTML = selection.entries
    .map((entry) => `
      <li>
        <span class="name">${asFormula(entry.label)}
          <span class="each">${escapeHtml(entry.categoryTitle)} &middot; ${signed(entry.value)} each</span>
        </span>
        <span class="stepper">
          <button data-step="-1" data-key="${escapeHtml(entry.key)}" aria-label="One fewer ${escapeHtml(entry.label)}">&minus;</button>
          <span class="n">${entry.count}</span>
          <button data-step="1" data-key="${escapeHtml(entry.key)}" aria-label="One more ${escapeHtml(entry.label)}">+</button>
        </span>
        <span class="sum">${signed(entry.value * entry.count)}</span>
        <button class="rm" data-remove="${escapeHtml(entry.key)}" aria-label="Remove ${escapeHtml(entry.label)}">&times;</button>
      </li>`)
    .join("");
}

function render() {
  renderGrid();
  renderTally();
}

function setQuery(query) {
  view.query = query.trim();
  el("clear").hidden = !view.query;
  renderTabs();
  render();
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

el("tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("button[data-tab]");
  if (!tab) return;
  view.activeTab = Number(tab.dataset.tab);
  el("filter").value = "";
  setQuery("");
});

el("grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-label]");
  if (!button) return;

  const category = view.categories.find((candidate) => candidate.file === button.dataset.file);
  const row = category?.rows.find((candidate) => candidate.label === button.dataset.label);
  if (!row) return;

  selection.add({
    categoryFile: category.file,
    categoryTitle: category.title,
    label: row.label,
    value: row.value,
  });
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

  const total = view.categories.reduce((sum, category) => sum + category.rows.length, 0);
  const unreadable = view.categories.flatMap((category) =>
    category.problems.map((problem) => `${category.file}:${problem.line} (${problem.reason})`));

  el("footer").innerHTML =
    `${total} increments across ${view.categories.length} categories, read from the ` +
    `project&rsquo;s CSV files. <a href="${REPO_URL}">Source and data on GitHub</a> &middot; GPL-3.0.` +
    (unreadable.length
      ? `<br><strong>${unreadable.length} row(s) could not be read:</strong> ${escapeHtml(unreadable.join(", "))}`
      : "");

  renderTabs();
  render();
} catch (error) {
  el("grid").innerHTML =
    `<p class="status">Could not load the increment data: ${escapeHtml(error.message)}.<br>
     If you opened this file straight from disk, serve the folder instead — for example
     <code>python -m http.server</code> — so the browser is allowed to read the CSV files.</p>`;
}
