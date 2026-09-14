/**
 * Searching the increments, and adding up a molecular formula from what was
 * chosen.
 *
 * A group name says what it is made of: `C-(C)2(H)2` is a carbon carrying two
 * carbons and two hydrogens. Decomposing a name into what it is made of - the
 * central notation, the ligands, the element composition - used to happen
 * here, in the browser, every time the page loaded. It now happens once, in
 * `benson/notation.py`, at build time: `dist/increments.json` carries each
 * increment's `kind`, `composition`, `central`, `ligands` and precomputed,
 * normalised `aliases` already worked out. This file is left with exactly the
 * part of the job that cannot be precomputed, because it depends on what a
 * student actually types or actually chooses:
 *
 * - normalise() and scoreOf() turn a keystroke into a score against an
 *   increment's precomputed aliases; search() sorts the results.
 * - summarise() adds a chosen set of increments' precomputed compositions
 *   into a molecular formula. addAtoms() and formulaOf() do the arithmetic
 *   and the Hill-order rendering, because which increments are chosen, and
 *   how many of each, is only known at the moment somebody picks them.
 *
 * Nothing in this file touches the DOM, so it runs in the browser and under
 * Node, and tools/notation.test.mjs exercises it against the real artifact.
 */

/** Everything an increment's precomputed `kind` can be. See benson/notation.py. */
export const GROUP = "group";
export const NAMED = "named";
export const ENERGY = "energy";
export const UNREADABLE = "unreadable";

/** How well a name answers to what was typed. Lower is better. */
export const MATCH = Object.freeze({ EXACT: 0, PREFIX: 1, CONTAINS: 2 });

/* -------------------------------------------------------------------------- */
/* Adding compositions together                                                */
/* -------------------------------------------------------------------------- */

export function addAtoms(into, atoms, times = 1) {
  for (const [element, count] of Object.entries(atoms)) {
    into[element] = (into[element] ?? 0) + count * times;
  }
  return into;
}

/**
 * Write a composition the way a chemist does: carbon, then hydrogen, then
 * everything else alphabetically (Hill order).
 */
export function formulaOf(atoms) {
  const rest = Object.keys(atoms).filter((element) => element !== "C" && element !== "H").sort();
  return ["C", "H", ...rest]
    .filter((element) => atoms[element] > 0)
    .map((element) => element + (atoms[element] > 1 ? atoms[element] : ""))
    .join("");
}

/* -------------------------------------------------------------------------- */
/* Searching                                                                   */
/* -------------------------------------------------------------------------- */

/** Compare names the way they are read aloud, ignoring brackets and dashes. */
export const normalise = (text) => String(text).toLowerCase().replace(/[^a-z0-9]/g, "");

/** How well a name answers to what was typed; null if it does not. See MATCH. */
export function scoreOf(query, aliases) {
  const wanted = normalise(query);
  if (!wanted) return null;

  let best = null;
  for (const alias of aliases) {
    const score = alias === wanted ? MATCH.EXACT
      : alias.startsWith(wanted) ? MATCH.PREFIX
        : alias.includes(wanted) ? MATCH.CONTAINS
          : null;
    if (score !== null && (best === null || score < best)) best = score;
  }
  return best;
}

/**
 * The increments matching a query, best first.
 *
 * Each result carries the synonym it was found under, when it was found under
 * one, so a search for "methyl" can show that word beside `C-(C)(H)3` and teach
 * the notation instead of merely producing it.
 *
 * Not sorted by anything but score: `index` already carries every increment in
 * tie-break order (category, then row - the order dist/increments.json was
 * built in), and Array.prototype.sort is stable, so ties keep that order for
 * free. `CH3` matches seven groups exactly, and the plain methyl comes out on
 * top because it is written first in the data, not because this file ranks
 * chemistry itself.
 */
export function search(query, index) {
  const wanted = normalise(query);
  if (!wanted) return [];

  const found = [];
  for (const entry of index) {
    const score = scoreOf(query, entry.aliases);
    if (score === null) continue;

    // Only a synonym that matched as well as anything else did; otherwise a
    // search for OH would report `O-(H)(C)` as found under "alcohol", which
    // merely contains those two letters, rather than under the notation that
    // actually answered.
    const matchedSynonym = entry.synonyms
      .find((synonym) => scoreOf(query, [normalise(synonym)]) === score) ?? null;

    found.push({ ...entry, score, matchedSynonym });
  }

  return found.sort((a, b) => a.score - b.score);
}

/* -------------------------------------------------------------------------- */
/* Adding up a formula                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The molecular formula implied by a set of chosen increments.
 *
 * `entries` are (group name, how many) pairs; `byLabel` is a label -> increment
 * Map, built from an artifact's index (see benson.js's loadArtifact()). Each
 * increment already carries its composition, precomputed; this only adds them
 * up. A label `byLabel` does not know reads as unreadable rather than being
 * silently skipped, for the same reason a group whose composition has not been
 * settled does: a formula quietly missing an atom is worse than no formula,
 * because a student has no way to tell.
 */
export function summarise(entries, byLabel) {
  const atoms = {};
  let groups = 0;
  let energy = 0;
  const unreadable = [];

  for (const entry of entries) {
    const increment = byLabel.get(entry.label);
    const count = entry.count ?? 1;

    if (!increment) {
      unreadable.push({ label: entry.label, reason: "not a known increment" });
      continue;
    }
    // A name spelled out as contributing nothing is an energy term too, however
    // much it looks like a group - which is what keeps `Cis- (one t-butyl)`,
    // filed among the CH groups, from adding a carbon that is not there.
    if (increment.kind === UNREADABLE) {
      unreadable.push({ label: entry.label, reason: increment.reason });
    } else if (Object.keys(increment.composition).length === 0) {
      energy += count;
    } else {
      groups += count;
      addAtoms(atoms, increment.composition, count);
    }
  }

  return {
    atoms,
    groups,
    energy,
    unreadable,
    formula: unreadable.length || !groups ? null : formulaOf(atoms),
  };
}
