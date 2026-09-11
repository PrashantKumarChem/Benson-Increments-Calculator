"""What a group name means.

A group name says what it is made of: `C-(C)2(H)2` is a carbon carrying two
carbons and two hydrogens. Searching uses that reading, so a student can find a
group by the shorthand they actually write rather than by the name the tables
print.

summarise() adds the same readings up into a molecular formula. Nothing shows it
yet: a formula only describes the molecule once every group of that molecule has
been chosen, and half-finished it looks wrong rather than incomplete - a carbon
written `C-(H)2(C)(N)` contributes no nitrogen, because that nitrogen belongs to
its own N group. It is kept, and tested, because the reading it needs is the same
one searching needs; see notation/README.md.

What cannot be derived from a name lives in notation/*.csv rather than here:
which atoms a central notation stands for, the handful of names that break the
pattern, and the words students use for a group. Adding a category of groups
written in ordinary Benson notation therefore needs no change here.

`assets/notation.js` applies the same rules in the browser until the website
reads a generated artifact instead.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field, replace
from enum import IntEnum
from typing import NamedTuple, Optional

from benson.data import NOTATION_DIR, Category, read_pairs

# A group name: a central notation, a dash, then its ligands in brackets, each
# optionally followed by how many there are.
#
# The whole name must match. That strictness is doing real work - it is what
# keeps the corrections and the cyclohexane A-values out, without this module
# ever having to know which file they came from. A looser pattern also swallows
# `Cis- (one t-butyl)` and `CO2-`, which would each contribute a phantom atom.
GROUP_NAME = re.compile(r"([A-Za-z][A-Za-z0-9]*)-((?:\([A-Za-z0-9]+\)\d*)+)", re.ASCII)
LIGAND = re.compile(r"\(([A-Za-z0-9]+)\)(\d*)", re.ASCII)

# An element and how many of it: `C`, `O`, and each part of `N O2`.
ELEMENT = re.compile(r"([A-Z][a-z]?)(\d*)", re.ASCII)

# Everything a name can turn out to be.
GROUP = "group"            # read from the notation
NAMED = "named"            # spelled out in special_labels.csv
ENERGY = "energy"          # not Benson notation: a correction or A-value
UNREADABLE = "unreadable"  # looks like a group, but what it holds cannot be said


class Match(IntEnum):
    """How well a name answers to what was typed. Lower is better."""

    EXACT = 0
    PREFIX = 1
    CONTAINS = 2


class InvalidCompositionError(ValueError):
    """A composition that is not element symbols with optional counts."""


# ---------------------------------------------------------------------------
# Compositions
# ---------------------------------------------------------------------------

def parse_composition(text) -> Optional[dict[str, int]]:
    """`none`, `unknown`, or a composition like `N O2`. None means unknown."""
    trimmed = str(text).strip()
    if not trimmed:
        raise InvalidCompositionError("empty composition")
    if trimmed == "unknown":
        return None
    if trimmed == "none":
        return {}

    atoms: dict[str, int] = {}
    for token in trimmed.split():
        match = ELEMENT.fullmatch(token)
        if not match:
            raise InvalidCompositionError(f"{token!r} is not an element symbol with an optional count")
        element, count = match.groups()
        atoms[element] = atoms.get(element, 0) + (int(count) if count else 1)
    return atoms


def add_atoms(into: dict[str, int], atoms: dict[str, int], times: int = 1) -> dict[str, int]:
    for element, count in atoms.items():
        into[element] = into.get(element, 0) + count * times
    return into


def formula_of(atoms: dict[str, int]) -> str:
    """Write a composition the way a chemist does: carbon, then hydrogen, then
    everything else alphabetically (Hill order)."""
    rest = sorted(element for element in atoms if element not in ("C", "H"))
    return "".join(
        element + (str(atoms[element]) if atoms[element] > 1 else "")
        for element in ["C", "H", *rest]
        if atoms.get(element, 0) > 0
    )


# ---------------------------------------------------------------------------
# The notation tables
# ---------------------------------------------------------------------------

class Problem(NamedTuple):
    """A row of a notation file that could not be taken as written."""

    file: str
    line: int
    message: str


@dataclass
class Notation:
    """What the notation files say. Empty tables are a valid answer.

    With nothing in them a name reads as an energy term and answers only to
    itself, which is what the calculator did before it could read notation at
    all - so there is one way of searching rather than two, and the path taken
    when the files are missing is the same path every test exercises.
    """

    centrals: dict[str, dict[str, int]] = field(default_factory=dict)
    ligands: dict[str, dict[str, int]] = field(default_factory=dict)
    #: None for a name whose composition has not been settled.
    named: dict[str, Optional[dict[str, int]]] = field(default_factory=dict)
    synonyms: dict[str, list[str]] = field(default_factory=dict)
    problems: list[Problem] = field(default_factory=list)


def empty_notation() -> Notation:
    return Notation()


@dataclass(frozen=True)
class NotationFile:
    """One notation file and what is true of it, so no reader has to guess."""

    name: str
    #: The Notation table its rows fill.
    table: str
    #: The key is a group name that must still exist in the data. Checking that
    #: needs the data, so tools/validate_data.py does it.
    keys_are_groups: bool
    #: The value is a composition rather than free text.
    values_are_compositions: bool
    #: A key may appear more than once, as a group may have several synonyms.
    keys_may_repeat: bool = False
    #: 'unknown' is an acceptable answer - true where a composition is still open.
    allows_unknown: bool = False
    #: What a value that must be definite is called, for the message.
    subject: str = ""


# The filenames are fixed here the way manifest.json's is: these are where the
# data lives, not chemistry. Every statement about chemistry is inside the files.
NOTATION_FILES = (
    NotationFile("central_atoms.csv", "centrals", keys_are_groups=False, values_are_compositions=True,
                 subject="a central notation"),
    NotationFile("ligand_atoms.csv", "ligands", keys_are_groups=False, values_are_compositions=True,
                 subject="a ligand"),
    NotationFile("special_labels.csv", "named", keys_are_groups=True, values_are_compositions=True,
                 allows_unknown=True),
    NotationFile("synonyms.csv", "synonyms", keys_are_groups=True, values_are_compositions=False,
                 keys_may_repeat=True),
)


def load_notation(notation_dir: str = NOTATION_DIR) -> Notation:
    """Read the notation files, reporting every row that cannot be taken as written.

    A row that is refused does not enter its table, and a key answered twice keeps
    its first answer, so what loads is always something the files actually say.
    """
    notation = Notation()
    for spec in NOTATION_FILES:
        path = os.path.join(notation_dir, spec.name)
        if not os.path.exists(path):
            notation.problems.append(
                Problem(spec.name, 0, f"missing - the calculator reads {NOTATION_DIR}/{spec.name}"))
            continue

        table = getattr(notation, spec.table)
        seen: dict[str, int] = {}
        for line, key, value in read_pairs(path):
            def refuse(message: str) -> None:
                notation.problems.append(Problem(spec.name, line, message))

            if not key:
                refuse(f"{value!r} has no name before the comma")
                continue
            if not value:
                refuse(f"{key!r} has no value")
                continue

            repeated = not spec.keys_may_repeat and key in seen
            if repeated:
                refuse(f"{key!r} is already answered on line {seen[key]}")
            elif not spec.keys_may_repeat:
                seen[key] = line

            if not spec.values_are_compositions:
                table.setdefault(key, []).append(value)
                continue

            # A repeated key is still checked, so one run reports everything
            # wrong with the row rather than only the first thing.
            try:
                atoms = parse_composition(value)
            except InvalidCompositionError:
                refuse(f"{key!r}: {value!r} is not element symbols with optional counts, "
                       "like 'C', 'N O2' or 'C2'")
                continue
            if atoms is None and not spec.allows_unknown:
                refuse(f"{key!r} cannot be 'unknown' - {spec.subject} must say what it is")
                continue
            if not repeated:
                table[key] = atoms
    return notation


# ---------------------------------------------------------------------------
# Reading one name
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Reading:
    """What one name was read as. `atoms` is None only when it is unreadable."""

    kind: str
    label: str
    atoms: Optional[dict[str, int]] = None
    central: Optional[str] = None
    #: (ligand token, how many), in the order the name writes them.
    ligands: tuple[tuple[str, int], ...] = ()
    #: What the ligands themselves contribute - in practice, the hydrogens.
    ligand_atoms: Optional[dict[str, int]] = None
    reason: Optional[str] = None


def read(label: str, notation: Notation) -> Reading:
    """What a group name is made of.

    The four outcomes are deliberately distinct. A name that is not written in
    Benson notation is a correction or an A-value: an energy term that really
    does contribute nothing, and saying so is correct rather than a guess. A name
    that *is* written in Benson notation but uses a central this data has never
    been told about is a different matter entirely - that is a gap, and it is
    reported so a formula is never quietly short of an atom.
    """
    if label in notation.named:
        atoms = notation.named[label]
        if atoms is None:
            return Reading(UNREADABLE, label, reason="its composition has not been settled yet")
        return Reading(NAMED, label, atoms=atoms)

    match = GROUP_NAME.fullmatch(label)
    if not match:
        return Reading(ENERGY, label, atoms={})

    central, tail = match.groups()

    # Almost every ligand is an atom that carries a group of its own, and is
    # counted there rather than here - counting it twice would give a carbon one
    # extra carbon for every neighbour it has. notation/ligand_atoms.csv names the
    # exceptions, which today means hydrogen: it never has a group of its own, so
    # a group is the only place its atoms are counted.
    ligands = []
    ligand_atoms: dict[str, int] = {}
    for token, count in LIGAND.findall(tail):
        how_many = int(count) if count else 1
        ligands.append((token, how_many))
        contributed = notation.ligands.get(token)
        if contributed:
            add_atoms(ligand_atoms, contributed, how_many)

    if central not in notation.centrals:
        return Reading(UNREADABLE, label, central=central, ligands=tuple(ligands),
                       reason=f"'{central}' is not in notation/central_atoms.csv")

    atoms = add_atoms(dict(notation.centrals[central]), ligand_atoms)
    return Reading(GROUP, label, atoms=atoms, central=central, ligands=tuple(ligands),
                   ligand_atoms=ligand_atoms)


# ---------------------------------------------------------------------------
# Searching
# ---------------------------------------------------------------------------

def normalise(text) -> str:
    """Compare names the way they are read aloud, ignoring brackets and dashes."""
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


def aliases_for(label: str, notation: Notation) -> list[str]:
    """The strings a group should be findable by.

    `C-(C)(H)3` is what the tables print, but a student writes CH3, so the
    notation is turned back into the shorthand it stands for: the central,
    followed by the atoms its ligands contribute.
    """
    found = {normalise(label): None}

    def add(text: str) -> None:
        if text:
            found[normalise(text)] = None

    reading = read(label, notation)
    if reading.kind == GROUP:
        suffix = formula_of(reading.ligand_atoms)
        add(reading.central + suffix)

        # The same shorthand with the bonding dropped, so that Cd, Ct and CB are
        # all carbon to someone typing CH2.
        #
        # Only where the central is a single element, though. Rewriting a central
        # as a formula otherwise makes one group answer to another group's name:
        # ONO and NO2 are both a nitrogen and two oxygens, but a nitrite ester is
        # not a nitro group and they are 10 kJ/mol apart. Centrals of more than one
        # element are already findable by the notation they are written in.
        own = notation.centrals[reading.central]
        if len(own) == 1:
            add(formula_of(own) + suffix)

    for synonym in notation.synonyms.get(label, []):
        add(synonym)
    return list(found)


def score_of(query, aliases) -> Optional[Match]:
    """How well a name answers to what was typed; None if it does not."""
    wanted = normalise(query)
    if not wanted:
        return None

    best = None
    for alias in aliases:
        score = (Match.EXACT if alias == wanted
                 else Match.PREFIX if alias.startswith(wanted)
                 else Match.CONTAINS if wanted in alias
                 else None)
        if score is not None and (best is None or score < best):
            best = score
    return best


@dataclass(frozen=True)
class Entry:
    """One increment, as searching sees it."""

    label: str
    #: The row as read, so how the source wrote the value is never lost on the way
    #: to whatever renders the entry.
    row: tuple[str, ...]
    category: Category
    category_index: int
    row_index: int
    aliases: tuple[str, ...]
    synonyms: tuple[str, ...]
    #: Set on a search result only.
    score: Optional[Match] = None
    matched_synonym: Optional[str] = None


def build_index(categories: list[Category], notation: Notation) -> list[Entry]:
    """A flat, searchable list of every increment, built once.

    The position each row holds in the data is kept, because it is what settles a
    tie: `CH3` matches seven groups exactly, and the CSV files are already ordered
    simplest first, so the plain methyl a student wants comes out on top without
    this code having to hold an opinion about which methyl matters most.
    """
    return [
        Entry(
            label=row[0],
            row=tuple(row),
            category=category,
            category_index=category_index,
            row_index=row_index,
            aliases=tuple(aliases_for(row[0], notation)),
            synonyms=tuple(notation.synonyms.get(row[0], [])),
        )
        for category_index, category in enumerate(categories)
        for row_index, row in enumerate(category.rows)
    ]


def search(query, index: list[Entry]) -> list[Entry]:
    """The increments matching a query, best first.

    Each result carries the synonym it was found under, when it was found under
    one, so a search for "methyl" can show that word beside `C-(C)(H)3` and teach
    the notation instead of merely producing it.
    """
    if not normalise(query):
        return []

    found = []
    for entry in index:
        score = score_of(query, entry.aliases)
        if score is None:
            continue

        # Only a synonym that matched as well as anything else did; otherwise a
        # search for OH would report `O-(H)(C)` as found under "alcohol", which
        # merely contains those two letters, rather than under the notation that
        # actually answered.
        matched = next((synonym for synonym in entry.synonyms
                        if score_of(query, [normalise(synonym)]) == score), None)
        found.append(replace(entry, score=score, matched_synonym=matched))

    return sorted(found, key=lambda entry: (entry.score, entry.category_index, entry.row_index))


# ---------------------------------------------------------------------------
# Adding up a formula
# ---------------------------------------------------------------------------

class Unreadable(NamedTuple):
    label: str
    reason: str


@dataclass(frozen=True)
class Summary:
    atoms: dict[str, int]
    groups: int
    energy: int
    unreadable: tuple[Unreadable, ...]
    formula: Optional[str]


def summarise(entries, notation: Notation) -> Summary:
    """The molecular formula implied by a set of chosen increments.

    `entries` are (group name, how many) pairs. Anything that cannot be read is
    listed rather than dropped, and while that list is not empty no formula is
    offered at all: a formula that is quietly missing an atom is worse than no
    formula, because a student has no way to tell. The energy terms are counted
    too, so a panel can say plainly that a ring correction was included in the
    total but contributes no atoms.
    """
    atoms: dict[str, int] = {}
    groups = 0
    energy = 0
    unreadable = []

    for label, count in entries:
        reading = read(label, notation)

        # A name spelled out as contributing nothing is an energy term too, however
        # much it looks like a group - which is what keeps `Cis- (one t-butyl)`,
        # filed among the CH groups, from adding a carbon that is not there.
        if reading.kind == UNREADABLE:
            unreadable.append(Unreadable(label, reading.reason))
        elif not reading.atoms:
            energy += count
        else:
            groups += count
            add_atoms(atoms, reading.atoms, count)

    return Summary(
        atoms=atoms,
        groups=groups,
        energy=energy,
        unreadable=tuple(unreadable),
        formula=None if unreadable or not groups else formula_of(atoms),
    )
