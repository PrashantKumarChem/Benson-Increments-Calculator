/**
 * Keep the notebook's transcription faithful to the notebook.
 *
 * tools/check_parity.mjs compares every increment as the site reads it against
 * every increment as the notebook reads it, and that comparison is what lets
 * the README say the two agree. But it does not run the notebook. It runs
 * tools/export_reference_values.py, which holds a hand transcription of the
 * notebook's own parse_value - copied deliberately, warts included, so that
 * the site is checked against what the notebook actually does rather than
 * against a tidied version of it.
 *
 * That leaves a gap the parity check cannot see. Edit the notebook's parsing
 * and leave the transcription alone, and check_parity keeps passing while the
 * thing it claims to compare against has moved. The claim would still be
 * printed, and would no longer be true.
 *
 * This closes it by reading the notebook itself. It follows the shape
 * tools/theme.test.mjs already uses to hold an inline script in index.html to
 * its module: the test reaches into the file that is not JavaScript, because
 * that file is where the truth is.
 *
 * If this fails, one of the two was changed without the other. Decide which is
 * right - usually the notebook - and copy it across verbatim, including
 * anything about it that looks like a bug. A wart that both sides share is
 * agreement; a wart on one side is drift.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const NOTEBOOK = "Benson Increments Calculator.ipynb";
const TRANSCRIPTION = "tools/export_reference_values.py";

/** Every code cell of a notebook, joined as one Python source text. */
function notebookSource(file) {
  const nb = JSON.parse(readFileSync(file, "utf8"));
  return nb.cells
    .filter((cell) => cell.cell_type === "code")
    .map((cell) => (Array.isArray(cell.source) ? cell.source.join("") : cell.source))
    .join("\n");
}

/**
 * One top-level function, from its `def` line to the next top-level statement.
 *
 * Python has no closing brace, so the end of a function is the next line that
 * starts in column zero.
 */
function functionSource(source, name) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`def ${name}(`));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === "" || /^\s/.test(lines[end]))) end++;
  return lines.slice(start, end).join("\n").trimEnd();
}

/**
 * The body, as the lines that carry meaning.
 *
 * The two copies are allowed to differ in three ways and no others: the
 * function's name, a docstring the transcription adds to explain why it exists,
 * and comments. Everything that decides what a value parses to must match.
 */
function body(source) {
  return source
    .replace(/"""[\s\S]*?"""/g, "")
    .split("\n")
    .slice(1)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trim().startsWith("#"));
}

test("the notebook's parse_value and its transcription have not drifted apart", () => {
  const notebook = functionSource(notebookSource(path.join(ROOT, NOTEBOOK)), "parse_value");
  const transcribed = functionSource(
    readFileSync(path.join(ROOT, TRANSCRIPTION), "utf8"), "notebook_parse_value");

  assert.ok(notebook, `no parse_value in ${NOTEBOOK} - has it been renamed?`);
  assert.ok(transcribed, `no notebook_parse_value in ${TRANSCRIPTION} - has it been renamed?`);

  assert.deepEqual(body(notebook), body(transcribed),
    `${TRANSCRIPTION} no longer matches ${NOTEBOOK}.\n` +
    "check_parity.mjs compares the site against the transcription, not against " +
    "the notebook, so it cannot see this. Copy the notebook's version across " +
    "verbatim - including anything that looks like a bug, because the point is " +
    "to agree with what the notebook does.");
});

test("the transcription still says why it is a copy", () => {
  // The comment is the only thing telling the next reader not to tidy the
  // wart away. Losing it is how the drift starts.
  const source = readFileSync(path.join(ROOT, TRANSCRIPTION), "utf8");
  assert.match(source, /Verbatim from/i);
  assert.match(source, new RegExp(NOTEBOOK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
