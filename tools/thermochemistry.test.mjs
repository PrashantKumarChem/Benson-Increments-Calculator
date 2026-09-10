/**
 * Does the increment data agree with experiment?
 *
 * Every other check in this repository proves the tool is internally
 * consistent. check_parity.mjs proves the notebook and the site read all 236
 * increments identically; validate_data.py proves the files are well formed.
 * None of them can notice a value that was mistranscribed from the published
 * table, because a wrong number is copied faithfully into both consumers and
 * satisfies every one of those rules.
 *
 * This test does not close that gap either. It sums groups for real molecules
 * and compares each total with an experimental gas-phase enthalpy of formation
 * looked up in the literature. What it catches is an increment wrong enough
 * that a molecule using it disagrees with experiment by more than the method's
 * own scatter, as the tolerance below sets it, and only for the groups these
 * molecules use. The less often these molecules use a group, the larger an
 * error in it has to be before that happens, and a transcription error too
 * small to get there passes. Nothing here checks a value against the source it
 * was printed in.
 *
 * The molecules are decomposed by hand, in tools/thermochemistry_data.mjs. That
 * is deliberate - structure perception is an explicit non-goal for this project,
 * so the decomposition is data rather than something the test works out.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadCategories } from "../assets/benson.js";
import { createSelection } from "../assets/selection.js";
import { MOLECULES } from "./thermochemistry_data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relative) => readFile(path.join(ROOT, relative), "utf8");

const categories = await loadCategories({ readText });

/**
 * Tolerance, in kJ/mol.
 *
 * Cohen 1996 reports a mean absolute error of about 5.5 kJ/mol for gas-phase
 * enthalpy of formation by group additivity. Individual molecules scatter above
 * a mean absolute error by definition, so a per-molecule bound has to sit above
 * it: PER_MOLECULE is twice the reported figure, the smallest round multiple
 * that ordinary method scatter does not breach.
 *
 * PER_MOLECULE is the bound that actually binds, and MEAN_ABSOLUTE is not a
 * second line of defence behind it. One wrong increment is concentrated in the
 * few molecules that use it, so it breaches a per-molecule bound long before it
 * moves a mean taken over the whole set: for every increment this table
 * exercises, no single-value error trips MEAN_ABSOLUTE without tripping
 * PER_MOLECULE first. MEAN_ABSOLUTE is asserted because it is the same
 * statistic Cohen publishes, which is what makes this set's agreement
 * checkable against the literature rather than only against itself.
 *
 * Neither number was chosen from the observed spread, which is the point. The
 * set currently sits near 1.1 kJ/mol mean absolute error with a worst case of
 * 5.7, so both bounds have room above the data. This is a guard against an
 * increment that disagrees with the published thermochemistry, not a
 * change-detector for the CSV files.
 */
const PER_MOLECULE = 11.0;
const MEAN_ABSOLUTE = 5.5;
/** Ceiling on an experimental value's own uncertainty; see the note on MOLECULES. */
const MAX_UNCERTAINTY = 3.0;

/** Look an increment up in the loaded data; fail loudly if the name is gone. */
function increment(file, label) {
  const category = categories.find((candidate) => candidate.file === file);
  assert.ok(category, `no category file ${file}`);
  const row = category.rows.find((candidate) => candidate.label === label);
  assert.ok(row, `no increment '${label}' in ${file}`);
  return { categoryFile: category.file, categoryTitle: category.title, label, value: row.value };
}

/** The group sum for one molecule, added up by the calculator's own arithmetic. */
function groupSum(molecule) {
  const selection = createSelection();
  for (const [file, label, count] of molecule.groups) {
    const item = increment(file, label);
    for (let i = 0; i < count; i += 1) selection.add(item);
  }
  return selection.totalKj;
}

for (const molecule of MOLECULES) {
  test(`${molecule.name} agrees with its experimental enthalpy of formation`, () => {
    const sum = groupSum(molecule);
    const miss = Math.abs(sum - molecule.experimental);

    assert.ok(
      miss <= PER_MOLECULE,
      `${molecule.name}: groups sum to ${sum.toFixed(2)} kJ/mol, experimental value ` +
      `${molecule.experimental} kJ/mol (${molecule.reference}), miss ${miss.toFixed(2)} kJ/mol ` +
      `exceeds the ${PER_MOLECULE} kJ/mol per-molecule tolerance`,
    );
  });
}

test("the whole set stays within the method's published mean absolute error", () => {
  const misses = MOLECULES.map((molecule) => Math.abs(groupSum(molecule) - molecule.experimental));
  const mean = misses.reduce((total, miss) => total + miss, 0) / misses.length;

  assert.ok(MOLECULES.length > 0, "the molecule table is empty, so nothing was compared");
  assert.ok(
    mean <= MEAN_ABSOLUTE,
    `mean absolute error is ${mean.toFixed(2)} kJ/mol over ${MOLECULES.length} molecules, ` +
    `which exceeds the ${MEAN_ABSOLUTE} kJ/mol Cohen 1996 reports for the method`,
  );
});

/**
 * `null` is the honest value when no DOI could be found, and it must say why.
 * Otherwise the DOI must be well-formed - and that is all this checks. It cannot
 * tell a wrong DOI from a right one: changing methyl acetate's ja00730a025 to
 * ja00730a026 gives a well-formed DOI for a real, unrelated paper in the same
 * journal, volume and year, and this still passes. tools/doi_lock.test.mjs is the
 * check that sees it, by comparing each citation with what its DOI resolved to.
 */
function assertDoi(label, source) {
  if (source.doi === null) {
    assert.ok(source.noDoiReason?.trim(), `${label} has no DOI and gives no reason why`);
    return;
  }
  assert.match(source.doi, /^10\.\d{4,9}\/\S+$/, `${label} has '${source.doi}', which is not a well-formed DOI`);
}

test("every experimental value carries a retrievable citation", () => {
  for (const molecule of MOLECULES) {
    assert.match(
      molecule.url,
      /^https:\/\/webbook\.nist\.gov\//,
      `${molecule.name} has no NIST WebBook URL`,
    );
    assert.ok(molecule.reference?.trim(), `${molecule.name} has no reference`);
    assert.ok(molecule.method?.trim(), `${molecule.name} has no method`);

    // A full citation names the work; the short reference cannot, because
    // author-year strings collide - see the note on MOLECULES.
    assert.ok(
      molecule.citation?.trim(),
      `${molecule.name} has no full bibliographic citation`,
    );
    assert.match(
      molecule.citation,
      /(1[89]|20)\d{2}/,
      `${molecule.name}'s citation states no year`,
    );

    assertDoi(molecule.name, molecule);

    // A comment that names another work changes whose number this is, so that
    // work must be cited too. These are the words NIST uses to point at one.
    if (/\b(by|see|reanaly[sz]ed)\b/i.test(molecule.nistComment ?? "")) {
      assert.ok(
        molecule.commentCites,
        `${molecule.name}'s NIST comment names another work ('${molecule.nistComment}') ` +
        "but the entry does not cite it",
      );
    }
    if (molecule.commentCites) {
      assert.match(
        molecule.commentCites.citation ?? "",
        /(1[89]|20)\d{2}/,
        `${molecule.name}: the work its NIST comment names has no dated citation`,
      );
      assertDoi(`${molecule.name} (the work its NIST comment names)`, molecule.commentCites);
    }

    // The curation rule in the note on MOLECULES, enforced rather than merely
    // described: a value known only to within several kJ/mol cannot adjudicate a
    // method whose own error is 5.5, so admitting one would weaken the comparison
    // silently.
    assert.ok(
      molecule.uncertainty === null || molecule.uncertainty <= MAX_UNCERTAINTY,
      `${molecule.name} carries an uncertainty of ${molecule.uncertainty} kJ/mol, above the ` +
      `${MAX_UNCERTAINTY} kJ/mol ceiling for an experimental value used here`,
    );
  }
});

test("no enthalpy sum draws on the cyclohexane A-values", () => {
  // The A-values are a conformational free energy, not an enthalpy of
  // formation. Adding one to a heat of formation is a category error that
  // arithmetic cannot see, and the interface deliberately puts those rows one
  // click away from the increments, so the mistake is easy to make.
  //
  // The two quantities allowed here are read from the manifest rather than
  // named as file numbers, so a sixth category of some third quantity is
  // refused on arrival instead of being silently summable.
  const ENTHALPY_QUANTITIES = new Set(["standard enthalpy of formation", "ring and steric correction"]);
  const quantities = new Map(categories.map((category) => [category.file, category.quantity]));

  for (const molecule of MOLECULES) {
    for (const [file] of molecule.groups) {
      const quantity = quantities.get(file);
      assert.ok(
        ENTHALPY_QUANTITIES.has(quantity),
        `${molecule.name} draws on ${file}, whose quantity is '${quantity}' - not an enthalpy contribution`,
      );
    }
  }
});
