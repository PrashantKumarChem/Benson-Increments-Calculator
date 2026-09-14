/**
 * Prove the site reads the data the same way the notebook does.
 *
 * Runs the notebook's own loading code (via tools/export_reference_values.py)
 * over the CSV files, and reads dist/increments.json - the artifact
 * benson/build.py derives from the same files - and compares every value.
 * Molecule totals are sums of these values, so if every increment agrees,
 * every total agrees — which is a stronger guarantee than checking a handful
 * of worked examples.
 *
 * After WP3, the site's own reading is the artifact rather than a second
 * parser: the two-implementations-checked-against-each-other shape this file
 * used to have is gone, because there is only one implementation of the value
 * rule left in JavaScript to check against - none. What remains worth proving
 * is that the artifact and the notebook still agree, and this is where that
 * proof lives until WP4 retires it for the conformance fixture.
 *
 *     node tools/check_parity.mjs
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON = process.env.PYTHON ?? "python";
/** Values are stored to two decimals; anything below this is float noise. */
const TOLERANCE = 1e-9;

function referenceValues() {
  const stdout = execFileSync(PYTHON, ["tools/export_reference_values.py"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout);
  return new Map(parsed.values.map((entry) => [`${entry.file}::${entry.label}`, entry]));
}

async function siteValues() {
  const text = await readFile(path.join(ROOT, "dist", "increments.json"), "utf8");
  const artifact = JSON.parse(text);
  return new Map(artifact.increments.map((entry) => [`${entry.category}::${entry.label}`, entry.value]));
}

const failures = [];
const reference = referenceValues();
const site = await siteValues();

for (const [key, entry] of reference) {
  if (entry.error) {
    failures.push(`${key}: the notebook itself fails here (${entry.error})`);
    continue;
  }
  if (!site.has(key)) {
    failures.push(`${key}: present in the notebook, missing from the site`);
    continue;
  }
  const mine = site.get(key);
  if (Math.abs(mine - entry.value) > TOLERANCE) {
    failures.push(`${key}: notebook ${entry.value}, site ${mine}`);
  }
}

for (const key of site.keys()) {
  if (!reference.has(key)) failures.push(`${key}: present on the site, missing from the notebook`);
}

if (failures.length) {
  console.error(`Parity check FAILED - ${failures.length} difference(s):\n`);
  for (const failure of failures.slice(0, 40)) console.error(`  ${failure}`);
  if (failures.length > 40) console.error(`  ... and ${failures.length - 40} more`);
  process.exit(1);
}

console.log(`Parity OK - ${site.size} increments read identically by the notebook and the site.`);
