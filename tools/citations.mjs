/**
 * Every citation whose DOI is locked: the thermochemistry test's, and each
 * reference in data/references.csv.
 *
 * data/references.csv is not parsed here. benson/build.py reads it, in file
 * order, into the `references` of dist/increments.json, and CI fails when that
 * artifact is stale - so reading it there is reading the file through the one
 * CSV parser this repository has, rather than through a second one written in
 * JavaScript.
 *
 * A reference carries a key, a citation and a DOI, and nothing yet that says
 * which work its DOI is meant to be. tools/doi_lock.mjs compares a DOI's record
 * with a citation's `work` fields and refuses a DOI that has none, so the first
 * reference given a DOI fails tools/doi_lock.test.mjs by name until those fields
 * have a column to live in. No reference has been added yet, and giving that
 * column a shape before the first one exists would be guessing at it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CITATIONS as TEST_CITATIONS } from "./thermochemistry_data.mjs";

export const ARTIFACT_FILE = "dist/increments.json";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The artifact's references, as the citations tools/doi_lock.mjs compares. */
export function referenceCitations(artifact) {
  if (!Array.isArray(artifact.references)) {
    // Absent is not empty: an artifact built before references existed would
    // otherwise lock no reference's DOI while looking as if it had checked them.
    throw new Error(`${ARTIFACT_FILE} has no references list. Run: python tools/build_dist.py`);
  }
  return artifact.references.map((reference) => ({
    citedBy: `data/references.csv ${reference.key}`,
    citation: reference.citation,
    doi: reference.doi,
  }));
}

export const CITATIONS = [
  ...TEST_CITATIONS,
  ...referenceCitations(JSON.parse(readFileSync(path.join(ROOT, ARTIFACT_FILE), "utf8"))),
];
