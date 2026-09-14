/**
 * Fetching the increment data and handing it back ready to use.
 *
 * The site used to read CSV_data_files/ directly and parse every cell itself;
 * this module now fetches dist/increments.json, the artifact benson/build.py
 * derives from those same files, and hands its contents back with categories
 * and increments cross-linked the way the rest of the site already expects
 * them. Nothing here parses a value, decomposes a group name, or computes a
 * search alias - benson/build.py did all of that once, at build time, and CI
 * regenerates the artifact and fails on a diff.
 *
 * Nothing here touches the DOM, so this file runs in the browser and under
 * Node, and tools/*.test.mjs exercises it against the real artifact.
 */

/** Read a file over HTTP, failing loudly on a missing or unreadable response. */
export async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} (HTTP ${response.status})`);
  return response.text();
}

/**
 * Fetch the artifact and cross-link it: every increment's `category` becomes
 * the category object it belongs to, rather than the filename string the JSON
 * carries, and every category gains a `rows` array of its own increments - the
 * shape `assets/app.js`, `assets/browse.js` and the test suite already expect,
 * because it is the shape `assets/notation.js`'s buildIndex() used to build
 * from CSV_data_files/ and notation/ directly.
 *
 * `readText` is injected rather than calling fetch directly so the same code
 * path can be exercised from Node against the file on disk.
 */
export async function loadArtifact({ readText, path = "dist/increments.json" } = {}) {
  if (typeof readText !== "function") throw new TypeError("loadArtifact needs a readText function");

  const artifact = JSON.parse(await readText(path));

  const categories = artifact.categories.map((category) => ({ ...category, rows: [] }));
  const byFile = new Map(categories.map((category) => [category.file, category]));

  const index = artifact.increments.map((increment) => {
    const category = byFile.get(increment.category);
    if (!category) {
      throw new Error(`${path}: increment '${increment.label}' names category ` +
        `'${increment.category}', which is not in the artifact's own categories list`);
    }
    const resolved = { ...increment, category };
    category.rows.push(resolved);
    return resolved;
  });

  return { schema: artifact.schema, display: artifact.display, categories, index };
}
