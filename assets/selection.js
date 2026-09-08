/**
 * The set of increments a user has chosen, and the arithmetic over it.
 *
 * Kept free of the DOM so the behaviour that matters — counts, undo order and
 * the running total — can be tested directly (tools/test_selection.mjs) rather
 * than by driving a browser.
 */

/** Identifies an increment across categories: two files may reuse a group name. */
export const keyOf = (categoryFile, label) => `${categoryFile}::${label}`;

export function createSelection() {
  /** One entry per distinct increment, in the order it was first chosen. */
  let entries = [];
  /** One key per addition, so undo can step back through individual clicks. */
  let clicks = [];

  const find = (key) => entries.find((entry) => entry.key === key);

  const dropIfEmpty = (entry) => {
    if (entry.count > 0) return;
    entries = entries.filter((candidate) => candidate !== entry);
    clicks = clicks.filter((click) => click !== entry.key);
  };

  return {
    get entries() {
      return entries.map((entry) => ({ ...entry }));
    },

    get isEmpty() {
      return entries.length === 0;
    },

    get totalKj() {
      return entries.reduce((sum, entry) => sum + entry.value * entry.count, 0);
    },

    countsByKey() {
      return new Map(entries.map((entry) => [entry.key, entry.count]));
    },

    add({ categoryFile, categoryTitle, label, value }) {
      const key = keyOf(categoryFile, label);
      const existing = find(key);
      if (existing) existing.count += 1;
      else entries.push({ key, categoryFile, categoryTitle, label, value, count: 1 });
      clicks.push(key);
    },

    /** Change a count by `delta`; the entry disappears when it reaches zero. */
    step(key, delta) {
      const entry = find(key);
      if (!entry) return;

      entry.count += delta;
      if (delta > 0) {
        for (let i = 0; i < delta; i += 1) clicks.push(key);
      } else {
        for (let i = 0; i < -delta; i += 1) {
          const last = clicks.lastIndexOf(key);
          if (last >= 0) clicks.splice(last, 1);
        }
      }
      dropIfEmpty(entry);
    },

    remove(key) {
      entries = entries.filter((entry) => entry.key !== key);
      clicks = clicks.filter((click) => click !== key);
    },

    /** Undo one addition, whether it came from the grid or a stepper. */
    undo() {
      const key = clicks.pop();
      if (!key) return;
      const entry = find(key);
      if (!entry) return;
      entry.count -= 1;
      dropIfEmpty(entry);
    },

    clear() {
      entries = [];
      clicks = [];
    },
  };
}
