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
 * A reference's `work` is what its Type, Title, Authors, Year, Volume, FirstPage
 * and Publisher columns say, in the shape benson/build.py gives it - the shape
 * the thermochemistry test writes by hand. tools/doi_lock.mjs compares a DOI's
 * record with it, and refuses a DOI whose reference names no Type.
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
    // Absent rather than null when there is none, as on the test's citations.
    ...(reference.work ? { work: reference.work } : {}),
  }));
}

export const CITATIONS = [
  ...TEST_CITATIONS,
  ...referenceCitations(JSON.parse(readFileSync(path.join(ROOT, ARTIFACT_FILE), "utf8"))),
];
