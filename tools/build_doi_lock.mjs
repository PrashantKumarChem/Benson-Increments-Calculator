/**
 * Write tools/doi_lock.json: what doi.org says each cited DOI is.
 *
 *     node tools/build_doi_lock.mjs
 *
 * The one check here that needs the network, which is why it is a generator and
 * not a test. tools/doi_lock.test.mjs compares the citations with the file this
 * writes, offline, and CI reruns this and fails if the committed file is not what
 * the DOIs resolve to today. See tools/doi_lock.mjs for what is compared, and for
 * what none of it proves.
 *
 * It resolves only the DOIs the citations already carry. It never searches, and
 * it never supplies a DOI: a citation recorded as `doi: null` has nothing to
 * resolve, and stays that way until a person finds and verifies one.
 *
 * Nothing is written unless every DOI resolves. A file missing a record would
 * turn a check that fails into a check that is not there.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CITATIONS } from "./thermochemistry_data.mjs";
import {
  LOCK_FILE,
  ResolverUnreachable,
  escapeInvisible,
  lockEntryFor,
  resolveDoi,
  serializeLock,
} from "./doi_lock.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** One request at a time, spaced out: Crossref has answered HTTP 429 to light load. */
const PAUSE_MS = 250;

const dois = [...new Set(CITATIONS.map((citation) => citation.doi).filter(Boolean))].sort();
const records = {};
const failures = [];

for (const [index, doi] of dois.entries()) {
  if (index) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  try {
    const entry = lockEntryFor(await resolveDoi(doi));
    records[doi] = entry;
    const year = entry.year ? `, ${entry.year}` : "";
    console.log(`  ${doi.padEnd(32)} ${entry.type}${year}: ${escapeInvisible(entry.title)}`);
  } catch (error) {
    if (!(error instanceof ResolverUnreachable)) {
      failures.push(error.message);
      continue;
    }
    // The resolver is down, not this DOI wrong. Every later request would wait
    // out the same retries, so stop here and say so.
    console.error(`\n${error.message}`);
    console.error(`${LOCK_FILE} was not written, and no citation was checked.`);
    process.exit(1);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} of ${dois.length} DOIs did not resolve to a citation record:`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`${LOCK_FILE} was not written.`);
  process.exit(1);
}

await writeFile(path.join(ROOT, LOCK_FILE), serializeLock(records));
console.log(`Wrote ${LOCK_FILE} - ${dois.length} DOIs, every one resolved.`);
