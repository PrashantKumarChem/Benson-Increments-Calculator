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
 * "1.05-1.76" is a published range and is averaged. The dash only separates a
 * range when it sits between two numbers, so a leading minus stays a negative
 * number rather than being read as an empty lower bound.
 */
const RANGE_RE = /^(-?\d*\.?\d+)\s*-\s*(-?\d*\.?\d+)$/;

export class InvalidValueError extends Error {}

/** Turn one cell into kJ/mol. Throws if the cell is neither a number nor a range. */
export function parseValue(raw) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new InvalidValueError("value is not finite");
    return raw;
  }
  const text = String(raw).trim().replace(/^"|"$/g, "");
  if (!text) throw new InvalidValueError("empty value");

  const range = RANGE_RE.exec(text);
  if (range) return (Number.parseFloat(range[1]) + Number.parseFloat(range[2])) / 2;
  if (NUMBER_RE.test(text)) return Number.parseFloat(text);

  throw new InvalidValueError(`'${text}' is neither a number nor a range like 1.05-1.76`);
}

/**
 * Parse a two-column CSV: everything before the last comma is the group name,
 * the remainder is the value. Rows that cannot be read are reported rather than
 * dropped in silence, so a bad file is visible instead of merely shorter.
 */
export function parseCsvText(text) {
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
    try {
      rows.push({ label, value: parseValue(line.slice(split + 1)) });
    } catch (error) {
      problems.push({ line: index + 2, text: label, reason: error.message });
    }
  });

  return { rows, problems };
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
