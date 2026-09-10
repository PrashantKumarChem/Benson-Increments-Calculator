/**
 * Reading and parsing the increment data.
 *
 * Nothing here touches the DOM, so the same code runs in the browser and under
 * Node. tools/check_parity.mjs uses that to assert this file and its Python
 * counterpart (tools/benson_data.py) agree on every value in the data set —
 * the two implementations of one rule cannot drift silently.
 */

/** Conversion factor from kilojoules to kilocalories (source: NIST). */
export const KJ_TO_KCAL = 0.239006;

const NUMBER_RE = /^-?\d*\.?\d+$/;
/**
 * "1.05 to 1.76" is a published range and is averaged. The separator is a word
 * rather than a hyphen because a hyphen also starts a negative number: reading
 * `-42` needs to know that its dash is a sign, and every implementation that
 * has to work that out is one that can work it out differently. `to` cannot be
 * a sign, so the two forms stop overlapping and the rule stops needing care.
 */
const RANGE_RE = /^(-?\d*\.?\d+)\s+to\s+(-?\d*\.?\d+)$/;
/**
 * The form this replaced. Matched only so it can be refused by name: falling
 * through to "neither a number nor a range" would tell a contributor their row
 * is unreadable without telling them it used to be the house style.
 */
const HYPHEN_RANGE_RE = /^(-?\d*\.?\d+)\s*-\s*(-?\d*\.?\d+)$/;

export class InvalidValueError extends Error {}

/** How many decimal places a written number claims. "-42" claims none. */
const decimalsOf = (text) => (text.split(".")[1] ?? "").length;

/**
 * Read one cell: its value in kJ/mol, and how the source wrote it.
 *
 * The value is the only thing the arithmetic uses, and it is unchanged - a
 * range is still averaged, a negative is still negative. What is new is that
 * the reading also carries the source's own precision and, for a range, its
 * two bounds, so the page can show `-42` rather than `-42.00` and can say that
 * 3.43 is the middle of 2.51 to 4.35 rather than a published figure.
 *
 * Throws if the cell is neither a number nor a range, exactly as before, so a
 * bad row is still reported rather than silently dropped.
 */
export function readValue(raw) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new InvalidValueError("value is not finite");
    const source = String(raw);
    return { value: raw, source, decimals: decimalsOf(source), isRange: false };
  }
  const text = String(raw).trim().replace(/^"|"$/g, "");
  if (!text) throw new InvalidValueError("empty value");

  const range = RANGE_RE.exec(text);
  if (range) {
    const low = Number.parseFloat(range[1]);
    const high = Number.parseFloat(range[2]);
    return {
      value: (low + high) / 2,
      source: text,
      decimals: Math.max(decimalsOf(range[1]), decimalsOf(range[2])),
      isRange: true,
      low,
      high,
    };
  }
  if (NUMBER_RE.test(text)) {
    return { value: Number.parseFloat(text), source: text, decimals: decimalsOf(text), isRange: false };
  }

  const hyphenated = HYPHEN_RANGE_RE.exec(text);
  if (hyphenated) {
    throw new InvalidValueError(
      `'${text}' writes a range with a hyphen, which also starts a negative number. ` +
      `Write it as '${hyphenated[1]} to ${hyphenated[2]}'.`,
    );
  }

  throw new InvalidValueError(`'${text}' is neither a number nor a range like '1.05 to 1.76'`);
}

/**
 * The value of one cell in kJ/mol.
 *
 * Defined in terms of readValue so there is one rule rather than two that can
 * drift; tools/check_parity.mjs holds this to the notebook's own reading.
 */
export function parseValue(raw) {
  return readValue(raw).value;
}

/**
 * Split a two-column CSV into name and value text, without interpreting either.
 *
 * Everything before the last comma is the name and the remainder is the value,
 * so a name may contain a comma but a value may not. The notation files in
 * notation/ are read by the same rule, which is why it is defined here instead
 * of being written out a second time.
 */
export function parseRows(text) {
  const rows = [];
  const problems = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);

  lines.slice(1).forEach((line, index) => {
    if (!line.trim()) return;
    const split = line.lastIndexOf(",");
    if (split < 0) {
      problems.push({ line: index + 2, text: line, reason: "no comma - expected two columns" });
      return;
    }
    const label = line.slice(0, split).trim().replace(/^"|"$/g, "");
    if (!label) {
      problems.push({ line: index + 2, text: line, reason: "missing group name" });
      return;
    }
    rows.push({ label, raw: line.slice(split + 1), line: index + 2 });
  });

  return { rows, problems };
}

/**
 * Parse a two-column CSV of increments. Rows that cannot be read are reported
 * rather than dropped in silence, so a bad file is visible instead of merely
 * shorter.
 */
export function parseCsvText(text) {
  const { rows, problems } = parseRows(text);
  const increments = [];

  for (const row of rows) {
    try {
      increments.push({ label: row.label, ...readValue(row.raw) });
    } catch (error) {
      problems.push({ line: row.line, text: row.label, reason: error.message });
    }
  }

  return { rows: increments, problems };
}

/**
 * Load every category listed in the manifest.
 *
 * `readText` is injected rather than calling fetch directly so the same code
 * path can be exercised from Node against the files on disk.
 */
export async function loadCategories({ readText, dataDir = "CSV_data_files" } = {}) {
  if (typeof readText !== "function") throw new TypeError("loadCategories needs a readText function");

  const manifest = JSON.parse(await readText(`${dataDir}/manifest.json`));
  const categories = manifest.categories ?? [];

  return Promise.all(categories.map(async (entry) => {
    const { rows, problems } = parseCsvText(await readText(`${dataDir}/${entry.file}`));
    return { ...entry, rows, problems };
  }));
}

/** Read a file over HTTP, failing loudly on a missing or unreadable response. */
export async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} (HTTP ${response.status})`);
  return response.text();
}
