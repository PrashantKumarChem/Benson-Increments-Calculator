/**
 * Tests for reading Benson notation.
 *
 * The load-bearing one is "every name in the data is understood": it fails the
 * moment somebody adds a group built on a central the notation files have never
 * heard of, which is the way a formula would otherwise end up quietly short of
 * an atom. The worked molecules are built from the real CSV rows rather than
 * from numbers typed in here, in keeping with the rest of the suite.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadCategories } from "../assets/benson.js";
import {
  ENERGY,
  GROUP,
  MATCH,
  NAMED,
  UNREADABLE,
  aliasesFor,
  buildIndex,
  emptyNotation,
  formulaOf,
  loadNotation,
  parseComposition,
  read,
  scoreOf,
  search,
  summarise,
} from "../assets/notation.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relative) => readFile(path.join(ROOT, relative), "utf8");

const categories = await loadCategories({ readText });
const notation = await loadNotation({ readText });
const index = buildIndex(categories, notation);

const everyLabel = categories.flatMap((category) =>
  category.rows.map((row) => ({ file: category.file, label: row.label })));

/** Describe a molecule as [group name, how many] and add up its formula. */
function molecule(parts) {
  return summarise(parts.map(([label, count]) => ({ label, count })), notation);
}

/* -------------------------------------------------------------------------- */
/* The notation files themselves                                               */
/* -------------------------------------------------------------------------- */

test("the notation files load without a single unreadable row", () => {
  assert.deepEqual(notation.problems, []);
  assert.ok(notation.centrals.size > 0, "central_atoms.csv is empty");
  assert.ok(notation.ligands.size > 0, "ligand_atoms.csv is empty");
  assert.ok(notation.synonyms.size > 0, "synonyms.csv is empty");
});

test("what a ligand contributes is read from the data, not assumed", () => {
  // Hydrogen is counted inside a group because it never has a group of its own.
  // That is a statement about the method, so it lives in ligand_atoms.csv - and
  // taking it away must change what a group is made of.
  assert.deepEqual(notation.ligands.get("H"), { H: 1 });

  const withoutLigands = { ...notation, ligands: new Map() };
  assert.deepEqual(read("C-(C)(H)3", withoutLigands).atoms, { C: 1 });
  assert.deepEqual(read("C-(C)(H)3", notation).atoms, { C: 1, H: 3 });
});

test("every synonym names a group that really exists", () => {
  const known = new Set(everyLabel.map((entry) => entry.label));
  const orphans = [...notation.synonyms.keys()].filter((label) => !known.has(label));
  assert.deepEqual(orphans, [], "synonyms.csv names groups that are no longer in the data");
});

test("every spelled-out name still exists in the data", () => {
  const known = new Set(everyLabel.map((entry) => entry.label));
  const orphans = [...notation.named.keys()].filter((label) => !known.has(label));
  assert.deepEqual(orphans, [], "special_labels.csv names groups that are no longer in the data");
});

/* -------------------------------------------------------------------------- */
/* Reading a name                                                              */
/* -------------------------------------------------------------------------- */

test("every name in the data is understood", () => {
  const unreadable = everyLabel
    .map((entry) => ({ ...entry, reading: read(entry.label, notation) }))
    .filter((entry) => entry.reading.kind === UNREADABLE && !notation.named.has(entry.label))
    .map((entry) => `${entry.file}: ${entry.label} - ${entry.reading.reason}`);

  assert.deepEqual(unreadable, [],
    "add the missing central notation to notation/central_atoms.csv, or the whole "
    + "name to notation/special_labels.csv");
});

test("a group's atoms are its central plus its hydrogen ligands", () => {
  assert.deepEqual(read("C-(C)(H)3", notation).atoms, { C: 1, H: 3 });
  assert.deepEqual(read("C-(C)2(H)2", notation).atoms, { C: 1, H: 2 });
  assert.deepEqual(read("O-(H)(C)", notation).atoms, { O: 1, H: 1 });
  assert.deepEqual(read("CO-(C)2", notation).atoms, { C: 1, O: 1 });
  assert.deepEqual(read("ONO-(C)", notation).atoms, { N: 1, O: 2 });
});

test("a ligand that is not hydrogen contributes nothing", () => {
  // The carbons in (C)3 belong to their own groups; counting them here would
  // count every carbon in the molecule as many times as it has neighbours.
  assert.deepEqual(read("C-(C)3(H)", notation).atoms, { C: 1, H: 1 });
  assert.deepEqual(read("N-(C)3", notation).atoms, { N: 1 });
});

test("corrections and A-values are energy terms, not groups", () => {
  for (const label of ["cyclohexane", "Gauche alkane", "cis correction", "cyclooctene (cis)"]) {
    assert.equal(read(label, notation).kind, ENERGY, label);
  }
  for (const label of ["CH3", "OCH3", "C(CH3)3", "CO2-", "F"]) {
    assert.equal(read(label, notation).kind, ENERGY, label);
  }
});

test("a row that only looks like a group adds no atoms", () => {
  // 'Cis- (one t-butyl)' sits in 01_CH_Groups.csv and starts like a group name.
  const reading = read("Cis- (one t-butyl)", notation);
  assert.equal(reading.kind, NAMED);
  assert.deepEqual(reading.atoms, {});
});

test("one value covering two groups counts both carbons", () => {
  // 'Ct-(CB) + CB-(Ct)' is a single row holding two groups; reading it as one
  // central atom would lose a carbon without anything saying so.
  const reading = read("Ct-(CB) + CB-(Ct)", notation);
  assert.equal(reading.kind, NAMED);
  assert.deepEqual(reading.atoms, { C: 2 });
});

test("a name whose composition is unsettled is reported, not treated as empty", () => {
  const reading = read("[COd]-Cd(H)2", notation);
  assert.equal(reading.kind, UNREADABLE);
  assert.match(reading.reason, /settled/);
});

test("a group built on an unknown central is reported", () => {
  const reading = read("S-(C)2", notation);
  assert.equal(reading.kind, UNREADABLE);
  assert.match(reading.reason, /central_atoms\.csv/);
});

/* -------------------------------------------------------------------------- */
/* Compositions and formulae                                                   */
/* -------------------------------------------------------------------------- */

test("a composition is element symbols with optional counts", () => {
  assert.deepEqual(parseComposition("C"), { C: 1 });
  assert.deepEqual(parseComposition("N O2"), { N: 1, O: 2 });
  assert.deepEqual(parseComposition("C2"), { C: 2 });
  assert.deepEqual(parseComposition("none"), {});
  assert.equal(parseComposition("unknown"), null);
  assert.throws(() => parseComposition("carbon"));
  assert.throws(() => parseComposition(""));
});

test("a formula is written carbon, hydrogen, then the rest alphabetically", () => {
  assert.equal(formulaOf({ H: 22, C: 10 }), "C10H22");
  assert.equal(formulaOf({ O: 1, C: 2, H: 6 }), "C2H6O");
  assert.equal(formulaOf({ N: 1, C: 2, H: 3 }), "C2H3N");
  assert.equal(formulaOf({ C: 1, H: 1 }), "CH");
  assert.equal(formulaOf({ C: 0, H: 2, O: 1 }), "H2O");
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
// has one, summarised to CH3N2. Nothing displayed it, because the formula is
// not shown yet, so only a test can keep this from coming back.
test("the nitrogen of a C=N is counted once, by NI and not also by CdN", () => {
  assert.deepEqual(read("CdN-(H)2", notation).atoms, { C: 1, H: 2 });
  assert.deepEqual(read("NI-(H)", notation).atoms, { N: 1, H: 1 });

  // `CdN` is a `Cd` whose partner happens to be nitrogen, so the two central
  // notations stand for the same atoms.
  assert.deepEqual(
    read("CdN-(H)2", notation).atoms,
    read("Cd-(H)2", notation).atoms,
    "CdN should contribute what Cd contributes",
  );

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

  assert.ok(!aliasesFor("ONO-(C)", notation).includes("no2"));
  assert.ok(!aliasesFor("NC-(C)", notation).includes("cn"));
  assert.ok(!aliasesFor("CdN-(C)2", notation).includes("cn"));

  // Each is still findable by the notation it is actually written in.
  assert.equal(search("ONO", index)[0].label, "ONO-(C)");
  assert.equal(search("NC", index)[0].label, "NC-(C)");
  assert.match(search("CdN", index)[0].label, /^CdN-/);
});

test("the bonding is searchable when a student wants it", () => {
  assert.ok(aliasesFor("Cd-(H)2", notation).includes("cdh2"));
  assert.ok(aliasesFor("Cd-(H)2", notation).includes("ch2"), "a double bond is still a CH2 to type");
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

test("ties are settled by the order the data is written in", () => {
  // Seven groups match 'CH3' exactly. The CSV files run simplest first, so the
  // plain methyl comes out on top without this code ranking chemistry itself.
  const exact = search("CH3", index).filter((entry) => entry.score === MATCH.EXACT);
  assert.ok(exact.length > 1, "expected several exact matches to tie");
  assert.equal(exact[0].label, "C-(C)(H)3");
  for (let i = 1; i < exact.length; i += 1) {
    const previous = exact[i - 1];
    const current = exact[i];
    assert.ok(previous.categoryIndex < current.categoryIndex
      || (previous.categoryIndex === current.categoryIndex && previous.rowIndex < current.rowIndex),
      "exact matches should stay in data order");
  }
});

test("searching for nothing matches nothing", () => {
  assert.deepEqual(search("", index), []);
  assert.deepEqual(search("   ", index), []);
  assert.deepEqual(search("zzzz", index), []);
});

test("the index covers every increment exactly once", () => {
  assert.equal(index.length, everyLabel.length);
});

test("searching still works when the notation files are missing", () => {
  // The page falls back to empty tables rather than to a second search of its
  // own, so this path is the same code as every other search - a group is just
  // findable by its printed name alone.
  const bare = buildIndex(categories, emptyNotation());

  assert.equal(search("C-(C)(H)3", bare)[0].label, "C-(C)(H)3");
  assert.equal(search("cyclohexane", bare)[0].label, "cyclohexane");

  // What is lost is exactly what the files provide: the shorthand a group
  // stands for, and the words people call it by.
  assert.deepEqual(search("methyl", bare), []);
  assert.ok(!search("CH2", bare).some((entry) => entry.label === "C-(C)2(H)2"),
    "without the files a methylene is not findable as CH2");
  assert.equal(search("CH2", index)[0].label, "C-(C)2(H)2", "with them it is the first hit");
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
