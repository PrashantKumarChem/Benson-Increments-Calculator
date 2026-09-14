/**
 * The artifact holds exactly what the site reads today.
 *
 * benson/build.py emits dist/increments.json from CSV_data_files/ and
 * notation/ through the package's own readers. assets/benson.js and
 * assets/notation.js still parse those same files independently, until WP3b
 * rewrites them to fetch the artifact instead. Until then, this is the proof
 * that the two readings agree - on every increment's label, category, value,
 * decimals and range bounds, and on every notation reading, alias and search
 * result - and it is WP3a's evidence for L12/L13 (the package and the site
 * read the two-column format by different rules, but never disagree on data
 * that exists).
 *
 * This test's job ends at WP3b: once assets/benson.js stops parsing, there is
 * only one reading left, and nothing is left to compare.
 *
 *     node --test tools/*.test.mjs
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadCategories } from "../assets/benson.js";
import { aliasesFor, buildIndex, loadNotation, normalise, read, scoreOf, search } from "../assets/notation.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relative) => readFile(path.join(ROOT, relative), "utf8");

const categories = await loadCategories({ readText });
const notation = await loadNotation({ readText });
const index = buildIndex(categories, notation);

const artifact = JSON.parse(await readText("dist/increments.json"));
const byLabel = new Map(artifact.increments.map((entry) => [entry.label, entry]));

test("the artifact carries the same increments the site reads, none missing or extra", () => {
  assert.equal(artifact.increments.length, index.length);
  assert.deepEqual(
    [...byLabel.keys()].sort(),
    index.map((entry) => entry.label).sort(),
  );
});

test("every increment's value, precision and range bounds match", () => {
  for (const entry of index) {
    const built = byLabel.get(entry.label);
    assert.ok(built, `${entry.label} is missing from the artifact`);
    assert.equal(built.category, entry.category.file, entry.label);
    assert.equal(built.value, entry.value, `${entry.label} value`);
    assert.equal(built.decimals, entry.decimals, `${entry.label} decimals`);
    assert.equal(built.isRange, entry.isRange, `${entry.label} isRange`);
    assert.equal(built.low, entry.low ?? null, `${entry.label} low`);
    assert.equal(built.high, entry.high ?? null, `${entry.label} high`);
    assert.equal(built.source, entry.source, `${entry.label} source`);
  }
});

test("D18: the stored value and unit ride beside the kJ/mol value, unconverted today", () => {
  // Every category declares kJ/mol (notation/categories.csv), so nothing
  // actually converts yet - this is what "unconverted" is checked against.
  for (const entry of index) {
    const built = byLabel.get(entry.label);
    assert.equal(built.unit, "kJ/mol", entry.label);
    assert.equal(built.storedValue, built.value, entry.label);
  }
});

test("every notation reading - kind, composition, central, ligands - matches", () => {
  for (const entry of index) {
    const built = byLabel.get(entry.label);
    const reading = read(entry.label, notation);
    assert.equal(built.kind, reading.kind, entry.label);
    assert.deepEqual(built.composition, reading.atoms ?? null, entry.label);
    assert.equal(built.central, reading.central ?? null, entry.label);
    assert.deepEqual(
      built.ligands,
      (reading.ligands ?? []).map(({ token, count }) => ({ token, count })),
      entry.label,
    );
    assert.equal(built.reason, reading.reason ?? null, entry.label);
  }
});

test("every precomputed alias and synonym matches aliasesFor()", () => {
  for (const entry of index) {
    const built = byLabel.get(entry.label);
    assert.deepEqual(built.aliases, aliasesFor(entry.label, notation), entry.label);
    assert.deepEqual(built.synonyms, entry.synonyms, entry.label);
  }
});

test("at least one reading of each kind is exercised, so the checks above are not vacuous", () => {
  const kinds = new Set(artifact.increments.map((entry) => entry.kind));
  assert.deepEqual(kinds, new Set(["group", "named", "energy", "unreadable"]));
});

/**
 * The residue D7 leaves in JavaScript: normalise() on the typed text,
 * scoreOf()'s exact/prefix/contains against the precomputed, normalised
 * aliases, and the sort by score then array order (the artifact already
 * carries increments in tie-break order, so no separate index is needed).
 * This proves that residue, run against the artifact's aliases, reproduces
 * exactly what today's full notation-reading search() returns.
 */
const QUERIES = [
  "CH3", "ch3", "methyl", "Methyl", "OH", "alcohol", "ketone", "amide",
  "nitrile", "ester", "COOH", "quaternary carbon", "C-(C)(H)3", "N-(C)3",
  "C", "H", "CB", "", "   ", "xyz123nonsense",
];

function searchArtifact(query, artifactIncrements) {
  const wanted = normalise(query);
  if (!wanted) return [];
  const found = [];
  for (const entry of artifactIncrements) {
    const score = scoreOf(query, entry.aliases);
    if (score === null) continue;
    const matchedSynonym = entry.synonyms
      .find((synonym) => scoreOf(query, [normalise(synonym)]) === score) ?? null;
    found.push({ label: entry.label, score, matchedSynonym });
  }
  return found.sort((a, b) => a.score - b.score);
}

test("searching the artifact's precomputed aliases matches searching the live index", () => {
  for (const query of QUERIES) {
    const fromArtifact = searchArtifact(query, artifact.increments)
      .map(({ label, score, matchedSynonym }) => ({ label, score, matchedSynonym }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const fromIndex = search(query, index)
      .map(({ label, score, matchedSynonym }) => ({ label, score, matchedSynonym }))
      .sort((a, b) => a.label.localeCompare(b.label));
    assert.deepEqual(fromArtifact, fromIndex, `query ${JSON.stringify(query)}`);
  }
});
