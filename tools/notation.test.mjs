/**
 * Tests for searching the increments and adding up a molecular formula.
 *
 * Decomposing a group name - what its central and ligands are, what atoms it
 * contributes, whether it is a group, a correction, a spelled-out name, or
 * unreadable - moved to benson/notation.py at WP3 and is tested there
 * (benson/tests/test_notation.py), against the real notation/ files. What is
 * left here is what still runs in the browser: turning a keystroke into a
 * score against an increment's precomputed aliases, and adding a chosen set of
 * increments' precomputed compositions into a formula. Both are exercised
 * against the real artifact, so a change to the data that would break search
 * or a formula is caught here rather than in a browser.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadArtifact } from "../assets/benson.js";
import {
  ENERGY,
  GROUP,
  MATCH,
  NAMED,
  UNREADABLE,
  formulaOf,
  scoreOf,
  search,
  summarise,
} from "../assets/notation.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relative) => readFile(path.join(ROOT, relative), "utf8");

const { index } = await loadArtifact({ readText, path: "dist/increments.json" });
const byLabel = new Map(index.map((entry) => [entry.label, entry]));

/** Describe a molecule as [group name, how many] and add up its formula. */
function molecule(parts) {
  return summarise(parts.map(([label, count]) => ({ label, count })), byLabel);
}

const find = (label) => byLabel.get(label);

/* -------------------------------------------------------------------------- */
/* What the artifact carries for each increment                               */
/* -------------------------------------------------------------------------- */

test("every increment carries a kind, and every kind actually occurs", () => {
  const kinds = new Set(index.map((entry) => entry.kind));
  assert.deepEqual(kinds, new Set([GROUP, NAMED, ENERGY, UNREADABLE]));
});

test("a group's composition is its central plus its hydrogen ligands", () => {
  assert.deepEqual(find("C-(C)(H)3").composition, { C: 1, H: 3 });
  assert.deepEqual(find("C-(C)2(H)2").composition, { C: 1, H: 2 });
  assert.deepEqual(find("O-(H)(C)").composition, { O: 1, H: 1 });
  assert.deepEqual(find("CO-(C)2").composition, { C: 1, O: 1 });
});

test("corrections and A-values are energy terms, not groups", () => {
  for (const label of ["cyclohexane", "F"]) {
    assert.equal(find(label).kind, ENERGY, label);
    assert.deepEqual(find(label).composition, {}, label);
  }
});

test("a name whose composition is unsettled is unreadable, with a reason", () => {
  // The [COd] rows are a chemist's call, left alone on purpose
  // (.claude/rules/data.md) - not a build fault (benson/build.py refuses to
  // ship a genuinely broken notation/ row rather than emit this).
  const reading = find("[COd]-Cd(H)2");
  assert.equal(reading.kind, UNREADABLE);
  assert.equal(reading.composition, null);
  assert.match(reading.reason, /settled/);
});

/* -------------------------------------------------------------------------- */
/* Molecules                                                                   */
/* -------------------------------------------------------------------------- */

test("a molecule's formula is the sum of the groups chosen for it", () => {
  const cases = [
    [[["C-(C)(H)3", 2], ["C-(C)2(H)2", 8]], "C10H22"],                       // decane
    [[["C-(C)(H)3", 1], ["C-(H)2(O)(C)", 1], ["O-(H)(C)", 1]], "C2H6O"],     // ethanol
    [[["CB-(H)", 6]], "C6H6"],                                               // benzene
    [[["C-(C)(H)3", 2], ["CO-(C)2", 1]], "C3H6O"],                           // acetone
    [[["Cd-(H)2", 2], ["C(allene)", 1]], "C3H4"],                            // allene
    [[["C-(C)(H)3", 1], ["CN-(C)", 1]], "C2H3N"],                            // acetonitrile
  ];

  for (const [parts, expected] of cases) {
    assert.equal(molecule(parts).formula, expected, parts.map(([l, n]) => `${n}x ${l}`).join(" + "));
  }
});

// A C=N is written as two groups, one for each end: the carbon is a `CdN` and
// the nitrogen an `NI`. Each end must contribute only its own atom, exactly as
// the two carbons of a C=C do. central_atoms.csv once gave `CdN` a nitrogen as
// well, so every imine came out with one nitrogen too many - methanimine, which
// has one, summarised to CH3N2. This is the regression test for that, ported to
// the artifact; benson/tests/test_notation.py pins the underlying rule.
test("the nitrogen of a C=N is counted once, by NI and not also by CdN", () => {
  assert.deepEqual(find("CdN-(H)2").composition, find("Cd-(H)2").composition,
    "CdN should contribute what Cd contributes");

  assert.equal(molecule([["CdN-(H)2", 1], ["NI-(H)", 1]]).formula, "CH3N");   // methanimine
  assert.equal(
    molecule([["CdN-(H)2", 1], ["NI-(C)", 1], ["C-(H)3(N)", 1]]).formula,
    "C2H5N",
  );                                                                          // N-methylmethanimine
});

test("a ring correction adds energy but no atoms", () => {
  const summary = molecule([["C-(C)2(H)2", 6], ["cyclohexane", 1]]);
  assert.equal(summary.formula, "C6H12");
  assert.equal(summary.groups, 6);
  assert.equal(summary.energy, 1);
});

test("nothing unreadable means no formula at all, rather than a short one", () => {
  const summary = molecule([["C-(C)(H)3", 2], ["[COd]-Cd(H)2", 1]]);
  assert.equal(summary.formula, null);
  assert.equal(summary.unreadable.length, 1);
  assert.equal(summary.unreadable[0].label, "[COd]-Cd(H)2");
});

test("corrections on their own produce no formula", () => {
  const summary = molecule([["cyclohexane", 1]]);
  assert.equal(summary.formula, null);
  assert.equal(summary.groups, 0);
  assert.equal(summary.energy, 1);
});

test("a label the artifact does not know is unreadable, not silently dropped", () => {
  const summary = molecule([["C-(C)(H)3", 1], ["NoSuchGroup", 1]]);
  assert.equal(summary.formula, null);
  assert.equal(summary.unreadable[0].label, "NoSuchGroup");
});

test("a formula is written carbon, hydrogen, then the rest alphabetically", () => {
  assert.equal(formulaOf({ H: 22, C: 10 }), "C10H22");
  assert.equal(formulaOf({ O: 1, C: 2, H: 6 }), "C2H6O");
  assert.equal(formulaOf({ N: 1, C: 2, H: 3 }), "C2H3N");
  assert.equal(formulaOf({ C: 1, H: 1 }), "CH");
  assert.equal(formulaOf({ C: 0, H: 2, O: 1 }), "H2O");
});

/* -------------------------------------------------------------------------- */
/* Searching                                                                   */
/* -------------------------------------------------------------------------- */

test("a group is findable by the shorthand a student writes", () => {
  const top = (query) => search(query, index)[0]?.label;

  assert.equal(top("CH3"), "C-(C)(H)3");
  assert.equal(top("CH2"), "C-(C)2(H)2");
  assert.equal(top("CH"), "C-(C)3(H)");
  assert.equal(top("OH"), "O-(H)(C)");
  assert.equal(top("NH2"), "N-(H)2(C)");
  assert.equal(top("ch3"), "C-(C)(H)3", "searching should not care about case");
});

test("the notation itself still finds a group", () => {
  assert.equal(search("C-(C)(H)3", index)[0].label, "C-(C)(H)3");
  assert.equal(search("O-(H)2", index)[0].label, "O-(H)2");
  assert.equal(search("CO-(C)(Cd)", index)[0].label, "CO-(C)(Cd)");
  assert.equal(search("cyclohexane", index)[0].label, "cyclohexane");
});

test("half-typed notation offers the family it belongs to", () => {
  // 'O-(H)' reads as an oxygen carrying one hydrogen, so the alcohol oxygen is
  // the exact answer and the rest of the O-(H) rows follow it.
  const labels = search("O-(H)", index).map((entry) => entry.label);
  assert.equal(labels[0], "O-(H)(C)");
  for (const expected of ["O-(H)2", "O-(H)(Cd)", "O-(H)(CB)", "O-(H)(Ct)"]) {
    assert.ok(labels.includes(expected), `expected ${expected} among the matches`);
  }
});

test("a curated name finds its group", () => {
  assert.equal(search("methyl", index)[0].label, "C-(C)(H)3");
  assert.equal(search("methylene", index)[0].label, "C-(C)2(H)2");
  assert.equal(search("ketone", index)[0].label, "CO-(C)2");
  assert.equal(search("nitrile", index)[0].label, "CN-(C)");
});

test("a group does not answer to another group's name", () => {
  // ONO and NO2 are both a nitrogen and two oxygens, and CdN, NC and CN are all
  // a carbon and a nitrogen - but a nitrite ester is not a nitro group and an
  // imine is not a nitrile. Searching must not put one at the top under the
  // other's name; they are tens of kJ/mol apart.
  assert.equal(search("NO2", index)[0].label, "NO2-(C)");
  assert.equal(search("CN", index)[0].label, "CN-(C)");

  assert.ok(!find("ONO-(C)").aliases.includes("no2"));
  assert.ok(!find("NC-(C)").aliases.includes("cn"));
  assert.ok(!find("CdN-(C)2").aliases.includes("cn"));

  // Each is still findable by the notation it is actually written in.
  assert.equal(search("ONO", index)[0].label, "ONO-(C)");
  assert.equal(search("NC", index)[0].label, "NC-(C)");
  assert.match(search("CdN", index)[0].label, /^CdN-/);
});

test("the bonding is searchable when a student wants it", () => {
  assert.ok(find("Cd-(H)2").aliases.includes("cdh2"));
  assert.ok(find("Cd-(H)2").aliases.includes("ch2"), "a double bond is still a CH2 to type");
  assert.equal(search("CdH2", index)[0].label, "Cd-(H)2");
});

test("an exact match outranks a partial one", () => {
  assert.equal(scoreOf("ch3", ["ch3"]), MATCH.EXACT);
  assert.equal(scoreOf("ch3", ["ch3o"]), MATCH.PREFIX);
  assert.equal(scoreOf("ch3", ["och3"]), MATCH.CONTAINS);
  assert.equal(scoreOf("ch3", ["cd"]), null);

  const results = search("CH3", index);
  assert.equal(results[0].score, MATCH.EXACT);
  assert.ok(results.some((entry) => entry.label === "OCH3"), "a weaker match should still be offered");
  assert.ok(results.findIndex((entry) => entry.label === "OCH3")
    > results.findIndex((entry) => entry.label === "C-(C)(H)3"), "but below the exact one");
});

test("ties are settled by the order the artifact is written in", () => {
  // Seven groups match 'CH3' exactly. The artifact carries every increment in
  // the CSV files' own order, which runs simplest first, so the plain methyl
  // comes out on top without this code ranking chemistry itself - and without
  // needing a categoryIndex/rowIndex pair of its own (search()'s sort is
  // stable, so ties keep the artifact's array order for free).
  const exact = search("CH3", index).filter((entry) => entry.score === MATCH.EXACT);
  assert.ok(exact.length > 1, "expected several exact matches to tie");
  assert.equal(exact[0].label, "C-(C)(H)3");

  const positionOf = new Map(index.map((entry, i) => [entry.label, i]));
  for (let i = 1; i < exact.length; i += 1) {
    assert.ok(positionOf.get(exact[i - 1].label) < positionOf.get(exact[i].label),
      "exact matches should stay in the artifact's own order");
  }
});

test("searching for nothing matches nothing", () => {
  assert.deepEqual(search("", index), []);
  assert.deepEqual(search("   ", index), []);
  assert.deepEqual(search("zzzz", index), []);
});

test("the index covers every increment exactly once", () => {
  assert.equal(new Set(index.map((entry) => entry.label)).size, index.length);
  assert.equal(index.length, 236);
});

test("a result says which synonym found it", () => {
  assert.equal(search("methyl", index)[0].matchedSynonym, "methyl");
  assert.equal(search("ketone", index)[0].matchedSynonym, "ketone");
  assert.equal(search("nitro", index)[0].matchedSynonym, "nitro");
  assert.equal(search("C-(C)(H)3", index)[0].matchedSynonym, null,
    "the notation is not a synonym");
});

test("a synonym is only credited when it is what answered", () => {
  // 'alcohol' contains the letters of OH, but O-(H)(C) is found by its notation
  // reading exactly; crediting the synonym there would be a small lie.
  const [top] = search("OH", index);
  assert.equal(top.label, "O-(H)(C)");
  assert.ok(top.synonyms.includes("alcohol"));
  assert.equal(top.matchedSynonym, null);
});
