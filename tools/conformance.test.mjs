/**
 * The contract both implementations are held to.
 *
 * tests/conformance.json pins input -> expected-output cases for the handful
 * of rules that a generated artifact cannot remove drift from: the tally
 * arithmetic, how a total is formatted, how a query is matched, and whether an
 * uncertainty propagates (D7 layer C, WP4). This file is the JavaScript side
 * of that contract; benson/tests/test_conformance.py is the other.
 *
 * Three of the four rules here are checked against the real production code -
 * createSelection() for tally, formatTotal()/combinedUncertainty() for total
 * and uncertainty, normalise()/scoreOf() for query - so a change to any of
 * them that breaks the pinned contract fails here, not just in a
 * reimplementation of the rule written for the test.
 *
 *     node --test tools/*.test.mjs
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { combinedUncertainty, formatTotal } from "../assets/format.js";
import { createSelection, keyOf } from "../assets/selection.js";
import { MATCH, normalise, scoreOf } from "../assets/notation.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(await readFile(path.join(ROOT, "tests", "conformance.json"), "utf8"));

/** The score labels the fixture uses, in place of MATCH's numeric constants. */
const SCORE_LABEL = new Map([[MATCH.EXACT, "exact"], [MATCH.PREFIX, "prefix"], [MATCH.CONTAINS, "contains"]]);

function tally(entries) {
  const selection = createSelection();
  entries.forEach((entry, i) => {
    const increment = { categoryFile: "fixture", label: `entry-${i}`, value: entry.value };
    selection.add(increment);
    if (entry.count > 1) selection.step(keyOf(increment.categoryFile, increment.label), entry.count - 1);
  });
  return selection.totalKj;
}

function query({ query: text, aliases }) {
  const score = scoreOf(text, aliases.map(normalise));
  return score === null ? null : SCORE_LABEL.get(score);
}

const RULES = {
  tally: (input) => tally(input.entries),
  total: (input) => formatTotal(input.kj),
  query,
  uncertainty: (input) => combinedUncertainty(input.individualUncertainties, input.methodFigure),
};

// Fail closed: a case naming a rule this file does not know about must stop
// the run, not be silently skipped - a skip is how a fixture can pass while
// pinning nothing.
for (const kase of fixture.cases) {
  if (!(kase.rule in RULES)) {
    throw new Error(`tests/conformance.json case '${kase.id}' names an unknown rule '${kase.rule}'`);
  }
}

assert.ok(fixture.cases.length > 0, "tests/conformance.json has no cases - nothing would be pinned");
for (const name of Object.keys(RULES)) {
  assert.ok(fixture.cases.some((kase) => kase.rule === name), `no fixture case exercises rule '${name}'`);
}

for (const kase of fixture.cases) {
  test(`conformance: ${kase.id} (${kase.rule})`, () => {
    const actual = RULES[kase.rule](kase.input);
    assert.deepEqual(actual, kase.expect, kase.why);
  });
}
