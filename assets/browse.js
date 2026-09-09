/**
 * What the user is looking at: which increments, and in what order.
 *
 * The calculator shows every category at once rather than one tab at a time,
 * because choosing groups for a molecule is a cross-category job. Axial
 * cyclohexanol needs two CH groups, two CHO groups, a ring correction and an
 * A-value: four of the five files for one molecule. Under exclusive tabs that
 * is four round trips, each one losing the scroll position of the last.
 *
 * Searching already worked this way - it has always spanned every category -
 * so this makes browsing agree with the half of the interface that was already
 * right. Categories become a filter that narrows rather than a place you go,
 * which is also why a twelfth category costs nothing here: it is another
 * section and another chip.
 *
 * These are plain functions over their arguments. The query and the chosen
 * filters are held by app.js alongside the event handlers that change them, so
 * there is one place that owns them rather than two that can disagree. Nothing
 * here touches the DOM, so tools/browse.test.mjs exercises it directly.
 */
import { search } from "./notation.js";

/**
 * The increments to show, in the order to show them.
 *
 * With no filter chosen the whole set is visible: an empty selection means
 * "everything", not "nothing", because the chips narrow a list that is already
 * complete. While searching, the order is relevance; otherwise it is the order
 * the CSV files are written in, which is already simplest-first.
 */
export function visibleRows(index, { query = "", files = new Set() } = {}) {
  const withinFilter = files.size
    ? index.filter((row) => files.has(row.category.file))
    : index;

  return query ? search(query, withinFilter) : withinFilter;
}

/**
 * Those increments split into the sections they are shown under.
 *
 * Browsing is grouped by category, so a sticky heading can say where you are
 * without spending any horizontal space on a sidebar. Searching is not: the
 * whole point of a search is that relevance outranks which file a group lives
 * in, and grouping the results would bury the best match under a heading.
 *
 * Sections carry the category itself rather than a title string, so the
 * wording stays with the rendering and this file has no opinion about copy.
 */
export function sectionsFor(rows, { query = "" } = {}) {
  if (query) return rows.length ? [{ key: "search", category: null, rows }] : [];

  const sections = [];
  const byFile = new Map();
  for (const row of rows) {
    const { file } = row.category;
    if (!byFile.has(file)) {
      const section = { key: file, category: row.category, rows: [] };
      byFile.set(file, section);
      sections.push(section);
    }
    byFile.get(file).rows.push(row);
  }
  return sections;
}

/**
 * How many of the visible increments came from each category.
 *
 * The chips show a count, and while a search is running that count should
 * describe the results rather than the whole file - otherwise a chip reads
 * "82" next to three matches.
 */
export function countsByCategory(rows) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.category.file, (counts.get(row.category.file) ?? 0) + 1);
  }
  return counts;
}

/** Add or remove one category from the filter, without mutating the original. */
export function toggleFilter(files, file) {
  const next = new Set(files);
  if (!next.delete(file)) next.add(file);
  return next;
}
