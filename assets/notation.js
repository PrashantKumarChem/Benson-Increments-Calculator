/**
 * Reading Benson notation.
 *
 * A group name says what it is made of: `C-(C)2(H)2` is a carbon carrying two
 * carbons and two hydrogens. Searching uses that reading, so a student can find
 * a group by the shorthand they actually write rather than by the name the
 * tables print.
 *
 * summarise() adds the same readings up into a molecular formula. Nothing shows
 * it yet: a formula only describes the molecule once every group of that
 * molecule has been chosen, and half-finished it looks wrong rather than
 * incomplete — a carbon written `C-(H)2(C)(N)` contributes no nitrogen, because
 * that nitrogen belongs to its own N group. It is kept, and tested, because the
 * reading it needs is the same one searching needs; see notation/README.md.
 *
 * Nothing in this file touches the DOM, so it runs in the browser and under
 * Node, and tools/notation.test.mjs exercises it against the real data.
 *
 * What cannot be derived from a name lives in notation/*.csv rather than in
 * this file: which atoms a central notation stands for, the handful of names
 * that break the pattern, and the words students use for a group. Adding a
 * category of groups written in ordinary Benson notation therefore needs no
 * change here.
 */
import { parseRows } from "./benson.js";

/**
 * A group name: a central notation, a dash, then its ligands in brackets, each
 * optionally followed by how many there are.
 *
 * The whole name must match. That strictness is doing real work — it is what
 * keeps the corrections and the cyclohexane A-values out, without this file
 * ever having to know which file they came from. A looser pattern also swallows
 * `Cis- (one t-butyl)` and `CO2-`, which would each contribute a phantom atom.
 */
const GROUP_NAME = /^([A-Za-z][A-Za-z0-9]*)-((?:\([A-Za-z0-9]+\)\d*)+)$/;
const LIGAND = /\(([A-Za-z0-9]+)\)(\d*)/g;

/** An element and how many of it: `C`, `O`, `N O2`, `C2`. */
const ELEMENT = /^([A-Z][a-z]?)(\d*)$/;

/** Everything a name can turn out to be. */
export const GROUP = "group";        // read from the notation
export const NAMED = "named";        // spelled out in special_labels.csv
export const ENERGY = "energy";      // not Benson notation: a correction or A-value
export const UNREADABLE = "unreadable"; // looks like a group, but we cannot say what it holds

/** How well a name answers to what was typed. Lower is better. */
export const MATCH = Object.freeze({ EXACT: 0, PREFIX: 1, CONTAINS: 2 });

/* -------------------------------------------------------------------------- */
/* Compositions                                                                */
/* -------------------------------------------------------------------------- */

/** `none`, `unknown`, or a composition like `N O2`. Returns null for unknown. */
export function parseComposition(text) {
  const trimmed = String(text).trim();
  if (!trimmed) throw new Error("empty composition");
  if (trimmed === "unknown") return null;
  if (trimmed === "none") return {};

  const atoms = {};
  for (const token of trimmed.split(/\s+/)) {
    const match = ELEMENT.exec(token);
    if (!match) throw new Error(`'${token}' is not an element symbol with an optional count`);
    const [, element, count] = match;
    atoms[element] = (atoms[element] ?? 0) + (count ? Number(count) : 1);
  }
  return atoms;
}

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
/* Reading one name                                                            */
/* -------------------------------------------------------------------------- */

/**
 * What a group name is made of.
 *
 * The four outcomes are deliberately distinct. A name that is not written in
 * Benson notation is a correction or an A-value: an energy term that really
 * does contribute nothing, and saying so is correct rather than a guess. A name
 * that *is* written in Benson notation but uses a central this data has never
 * been told about is a different matter entirely — that is a gap, and it is
 * reported so a formula is never quietly short of an atom.
 */
export function read(label, notation) {
  if (notation.named.has(label)) {
    const atoms = notation.named.get(label);
    return atoms === null
      ? { kind: UNREADABLE, label, reason: "its composition has not been settled yet" }
      : { kind: NAMED, label, atoms };
  }

  const match = GROUP_NAME.exec(label);
  if (!match) return { kind: ENERGY, label, atoms: {} };

  const [, central, tail] = match;

  // Almost every ligand is an atom that carries a group of its own, and is
  // counted there rather than here - counting it twice would give a carbon one
  // extra carbon for every neighbour it has. notation/ligand_atoms.csv names
  // the exceptions, which today means hydrogen: it never has a group of its
  // own, so a group is the only place its atoms are counted.
  const ligands = [];
  const ligandAtoms = {};
  for (const ligand of tail.matchAll(LIGAND)) {
    const count = ligand[2] ? Number(ligand[2]) : 1;
    ligands.push({ token: ligand[1], count });
    const contributed = notation.ligands.get(ligand[1]);
    if (contributed) addAtoms(ligandAtoms, contributed, count);
  }

  if (!notation.centrals.has(central)) {
    return { kind: UNREADABLE, central, ligands, label, reason: `'${central}' is not in notation/central_atoms.csv` };
  }

  const atoms = addAtoms({ ...notation.centrals.get(central) }, ligandAtoms);
  return { kind: GROUP, central, ligands, ligandAtoms, label, atoms };
}

/* -------------------------------------------------------------------------- */
/* Searching                                                                   */
/* -------------------------------------------------------------------------- */

/** Compare names the way they are read aloud, ignoring brackets and dashes. */
export const normalise = (text) => String(text).toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The strings a group should be findable by.
 *
 * `C-(C)(H)3` is what the tables print, but a student writes CH3, so the
 * notation is turned back into the shorthand it stands for: the central,
 * followed by the atoms its ligands contribute.
 */
export function aliasesFor(label, notation) {
  const found = new Set([normalise(label)]);
  const add = (text) => { if (text) found.add(normalise(text)); };

  const reading = read(label, notation);
  if (reading.kind === GROUP) {
    const suffix = formulaOf(reading.ligandAtoms);
    add(reading.central + suffix);

    // The same shorthand with the bonding dropped, so that Cd, Ct and CB are
    // all carbon to someone typing CH2.
    //
    // Only where the central is a single element, though. Rewriting a central
    // as a formula otherwise makes one group answer to another group's name:
    // ONO and NO2 are both a nitrogen and two oxygens, but a nitrite ester is
    // not a nitro group and they are 10 kJ/mol apart. Centrals of more than one
    // element are already findable by the notation they are written in.
    const own = notation.centrals.get(reading.central);
    if (Object.keys(own).length === 1) add(formulaOf(own) + suffix);
  }

  for (const synonym of notation.synonyms.get(label) ?? []) add(synonym);
  return [...found];
}

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
 * A flat, searchable list of every increment, built once.
 *
 * The position each row holds in the data is kept, because it is what settles a
 * tie: `CH3` matches seven groups exactly, and the CSV files are already
 * ordered simplest first, so the plain methyl a student wants comes out on top
 * without this code having to hold an opinion about which methyl matters most.
 */
export function buildIndex(categories, notation) {
  const index = [];
  categories.forEach((category, categoryIndex) => {
    category.rows.forEach((row, rowIndex) => {
      index.push({
        label: row.label,
        value: row.value,
        category,
        categoryIndex,
        rowIndex,
        aliases: aliasesFor(row.label, notation),
        synonyms: notation.synonyms.get(row.label) ?? [],
      });
    });
  });
  return index;
}

/**
 * The increments matching a query, best first.
 *
 * Each result carries the synonym it was found under, when it was found under
 * one, so a search for "methyl" can show that word beside `C-(C)(H)3` and teach
 * the notation instead of merely producing it.
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

  return found.sort((a, b) =>
    a.score - b.score || a.categoryIndex - b.categoryIndex || a.rowIndex - b.rowIndex);
}

/* -------------------------------------------------------------------------- */
/* Adding up a formula                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The molecular formula implied by a set of chosen increments.
 *
 * Anything that cannot be read is listed rather than dropped, and while that
 * list is not empty no formula is offered at all: a formula that is quietly
 * missing an atom is worse than no formula, because a student has no way to
 * tell. The energy terms are counted too, so the panel can say plainly that a
 * ring correction was included in the kJ/mol but contributes no atoms.
 */
export function summarise(entries, notation) {
  const atoms = {};
  let groups = 0;
  let energy = 0;
  const unreadable = [];

  for (const entry of entries) {
    const reading = read(entry.label, notation);
    const count = entry.count ?? 1;

    // A name spelled out as contributing nothing is an energy term too, however
    // much it looks like a group - which is what keeps `Cis- (one t-butyl)`,
    // filed among the CH groups, from adding a carbon that is not there.
    if (reading.kind === UNREADABLE) unreadable.push({ label: entry.label, reason: reading.reason });
    else if (Object.keys(reading.atoms).length === 0) energy += count;
    else {
      groups += count;
      addAtoms(atoms, reading.atoms, count);
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

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

/** Read one two-column file into a Map, reporting rows that make no sense. */
function readTable(text, file, onValue, problems) {
  const table = new Map();
  const { rows, problems: rowProblems } = parseRows(text);
  for (const problem of rowProblems) problems.push({ file, ...problem });

  for (const row of rows) {
    try {
      onValue(table, row.label, row.raw.trim());
    } catch (error) {
      problems.push({ file, line: row.line, text: row.label, reason: error.message });
    }
  }
  return table;
}

/** A composition, refusing 'unknown' where an answer is required. */
function definiteComposition(raw, what) {
  const atoms = parseComposition(raw);
  if (atoms === null) throw new Error(`${what} cannot be 'unknown'`);
  return atoms;
}

/**
 * Notation tables that say nothing.
 *
 * A name then reads as an energy term and answers only to itself, which is what
 * the calculator did before it could read the notation at all. It means the
 * page has one way of searching rather than two, so the path taken when the
 * files are missing is the same path that is exercised by every test.
 */
export function emptyNotation() {
  return { centrals: new Map(), ligands: new Map(), named: new Map(), synonyms: new Map(), problems: [] };
}

/**
 * Load the notation tables.
 *
 * The filenames are fixed here the way `manifest.json` already is: a browser
 * cannot list a folder, and these are resource locations rather than chemistry.
 * Every statement about chemistry is inside the files.
 */
export async function loadNotation({ readText, dataDir = "notation" } = {}) {
  if (typeof readText !== "function") throw new TypeError("loadNotation needs a readText function");

  const [centralText, ligandText, namedText, synonymText] = await Promise.all([
    readText(`${dataDir}/central_atoms.csv`),
    readText(`${dataDir}/ligand_atoms.csv`),
    readText(`${dataDir}/special_labels.csv`),
    readText(`${dataDir}/synonyms.csv`),
  ]);

  const problems = [];
  const once = (table, label) => {
    if (table.has(label)) throw new Error(`'${label}' already has a composition`);
  };

  const centrals = readTable(centralText, "central_atoms.csv", (table, label, raw) => {
    once(table, label);
    table.set(label, definiteComposition(raw, "a central notation"));
  }, problems);

  const ligands = readTable(ligandText, "ligand_atoms.csv", (table, label, raw) => {
    once(table, label);
    table.set(label, definiteComposition(raw, "a ligand"));
  }, problems);

  const named = readTable(namedText, "special_labels.csv", (table, label, raw) => {
    once(table, label);
    table.set(label, parseComposition(raw));
  }, problems);

  const synonyms = readTable(synonymText, "synonyms.csv", (table, label, raw) => {
    if (!raw) throw new Error("missing synonym");
    table.set(label, [...(table.get(label) ?? []), raw]);
  }, problems);

  return { centrals, ligands, named, synonyms, problems };
}
