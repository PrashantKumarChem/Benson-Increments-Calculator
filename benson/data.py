"""Finding the source data and reading it into records.

What counts as a category file and the order its filename declares, reading
one into rows, the notation-style two-column files, the metadata saying what a
category's numbers are, the references a row's Source names, and the published
figures for the method's own error.

Reading does not judge: tools/validate_data.py asks whether what was read is
valid, once the rows are in hand. A folder that is not this repository's is
read by exactly these rules, which is what lets a user's own file in.
"""
from __future__ import annotations

import csv
import glob
import os
import re
from dataclasses import dataclass, field
from typing import NamedTuple, Optional

from benson.values import cell_text, read_uncertainty, to_kj

CSV_DIR = "CSV_data_files"
# Hand-edited, and optional: what a category's numbers are, and where they came
# from. A category with no row here still works and shows exactly what it always
# showed, so dropping a CSV into CSV_DIR remains the whole of adding one.
#
# It lives in NOTATION_DIR rather than beside the increments, because that
# folder is for what the data means rather than for the data. Keeping CSV_DIR
# to nothing but increment files is not tidiness: the notebook globs
# it and reads whatever it finds as increments, so a six-column file there
# would become a category of nonsense buttons in the reference implementation.
# What the group names are made of, the words students use for them, and what
# each category of numbers actually is.
NOTATION_DIR = "notation"
METADATA_NAME = "categories.csv"
#: The columns of METADATA_NAME, in order. "File" is the key; the rest may be blank.
METADATA_FIELDS = ("quantity", "symbol", "unit", "source", "note")

# 01_CH_Groups.csv -> ordering prefix, then the category name.
FILENAME_RE = re.compile(r"^(\d{2})_([A-Za-z0-9_]+)\.csv$")


def title_for(stem: str) -> str:
    """01_CH_Groups -> 'CH Groups'.

    The casing a contributor writes in the filename is the casing shown in the
    tab, so no list of chemical acronyms has to live in the code: CH stays CH
    because it was already written that way.
    """
    match = FILENAME_RE.match(stem + ".csv")
    name = match.group(2) if match else stem
    return " ".join(name.split("_"))


#: The columns a category file may carry after its group name and value, found
#: by header name. The first two are found by position instead: their titles
#: have always been free text ("Delta_Hf kJ/mol"), and every file written that
#: way has to stay valid untouched (D9).
OPTIONAL_COLUMNS = ("Unit", "Uncertainty", "Source", "Verified", "Note")


class Row(NamedTuple):
    """One increment as its file writes it. A column the file does not have reads as blank."""

    group: str
    value: str
    unit: str = ""
    uncertainty: str = ""
    source: str = ""
    verified: str = ""
    note: str = ""


@dataclass
class Category:
    """One CSV file: its identity on disk and what was read from it."""

    path: str
    columns: list[str] = field(default_factory=list)
    #: Every line after the header that is not blank, as (line number, cells),
    #: whether or not it is a usable row. A malformed line is kept so that it can
    #: be reported, and numbered as it is in the file so that it is reported where
    #: it is.
    records: list[tuple[int, tuple[str, ...]]] = field(default_factory=list)

    @property
    def width(self) -> int:
        """The most cells a row may hold: one per column, and never fewer than the two required."""
        return max(len(self.columns), 2)

    def cell(self, cells, column: str) -> str:
        """A line's cell under an optional column; blank where there is none.

        A line may stop before its trailing optional cells, which says no more
        about them than a blank cell would. So may a file leave a column out
        altogether, which is what keeps a two-column file valid.
        """
        try:
            index = self.columns.index(column, 2)
        except ValueError:
            return ""
        return cells[index] if index < len(cells) else ""

    def row_of(self, cells) -> Optional[Row]:
        """The increment a line holds, or None when it is not a group name and a value.

        A line with more cells than the header has columns is not a row: the
        extra cell has to have come from a stray comma, and reading it as
        anything would put a value under the wrong column.
        """
        if not 2 <= len(cells) <= self.width or not cells[0]:
            return None
        return Row(cells[0], cells[1], *(self.cell(cells, column) for column in OPTIONAL_COLUMNS))

    @property
    def numbered_rows(self) -> list[tuple[int, Row]]:
        """Each increment with the line it starts on, so a fault is reported where it is."""
        rows = ((line, self.row_of(cells)) for line, cells in self.records)
        return [(line, row) for line, row in rows if row is not None]

    @property
    def rows(self) -> list[Row]:
        """The lines that are a group name and a value, which is what the category holds."""
        return [row for _, row in self.numbered_rows]

    @property
    def file(self) -> str:
        return os.path.basename(self.path)

    @property
    def stem(self) -> str:
        return self.file[:-4]

    @property
    def title(self) -> str:
        return title_for(self.stem)

    @property
    def has_valid_name(self) -> bool:
        return FILENAME_RE.match(self.file) is not None


def read_category(path: str) -> Category:
    """Read one CSV without judging it: validation is validate_data.py's job."""
    with open(path, encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        if header is None:
            return Category(path=path)
        records = []
        # Where the next line starts. The reader's own count is where the last
        # one ended, which is further on when a quoted cell ran over a line break.
        start = reader.line_num + 1
        for cells in reader:
            cells = tuple(c.strip() for c in cells)
            if len(cells) > 1 or (cells and cells[0]):
                records.append((start, cells))
            start = reader.line_num + 1
    return Category(path=path, columns=[c.strip() for c in header], records=records)


def read_pairs(path: str):
    """Read a two-column file as (line number, key, value).

    Split on the last comma, which is what assets/notation.js does, so a group
    name may contain a comma even though a value may not. A key is a cell as the
    site reads one, so one quote comes off each end.
    """
    with open(path, encoding="utf-8-sig") as handle:
        for offset, line in enumerate(handle.read().splitlines()[1:]):
            if not line.strip():
                continue
            key, comma, value = line.rpartition(",")
            if not comma:
                yield offset + 2, line.strip(), ""
            else:
                yield offset + 2, cell_text(key), value.strip()


def read_metadata(notation_dir: str = NOTATION_DIR) -> dict[str, dict[str, str]]:
    """What each category holds, keyed by filename. Absent file means no metadata.

    Read with the csv module rather than by splitting on commas, because unlike
    the increment files this one has six columns and a note that may contain
    prose. Unknown columns are ignored so a contributor can annotate the file
    without breaking it; missing ones read as blank.
    """
    path = os.path.join(notation_dir, METADATA_NAME)
    if not os.path.exists(path):
        return {}

    metadata: dict[str, dict[str, str]] = {}
    with open(path, encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            name = (row.get("File") or "").strip()
            if not name:
                continue
            metadata[name] = {
                field: (row.get(field.capitalize()) or "").strip()
                for field in METADATA_FIELDS
            }
    return metadata


def find_categories(csv_dir: str = CSV_DIR) -> list[Category]:
    """Every CSV in the folder, ordered by filename so the numeric prefix works.

    Everything in CSV_DIR is an increment file. Nothing is filtered out here,
    which is deliberate: a stray file is reported by validate_data.py rather
    than quietly ignored, because the notebook would read it as increments.
    """
    return [read_category(p) for p in sorted(glob.glob(os.path.join(csv_dir, "*.csv")))]


#: What a row's Source names. Hand-edited: one row per published work, under a
#: short key the increment files use in place of a full citation. Nobody numbers
#: them - a reference's number is its place in this file, so inserting one
#: renumbers the rest with nothing to edit by hand.
REFERENCES_PATH = "data/references.csv"
#: The columns that say which work a reference is: what tools/doi_lock.mjs
#: compares a DOI's record with, since a DOI is opaque and a near miss resolves
#: to a real, different paper. Each is read off the citation beside it, and the
#: lock checks that it was. Which of them a work is compared on depends on its
#: Type - a journal article on its title, authors, year, volume and first page;
#: a dataset on its title and publisher - and that table is the lock's alone.
WORK_COLUMNS = ("Type", "Title", "Authors", "Year", "Volume", "FirstPage", "Publisher")
#: The columns of REFERENCES_PATH, found by title. Only Key and Citation must be
#: filled in; a reference with no DOI needs no work columns either.
REFERENCE_COLUMNS = ("Key", "Citation", "DOI") + WORK_COLUMNS


class Reference(NamedTuple):
    """One published work a row may name as its Source.

    The fields after `doi` are WORK_COLUMNS, in order, as written: blank where
    the file leaves them blank. work_of() says what they amount to.
    """

    line: int
    key: str
    citation: str
    doi: str
    type: str = ""
    title: str = ""
    authors: str = ""
    year: str = ""
    volume: str = ""
    first_page: str = ""
    publisher: str = ""


def read_references(path: str = REFERENCES_PATH) -> list[Reference]:
    """Every reference with a key, in file order. An absent file means none.

    File order is the numbering, so nothing here sorts. A line without a key is
    not a reference, since no row could name it; tools/validate_data.py reports
    it rather than letting it vanish.
    """
    if not os.path.exists(path):
        return []
    table = read_category(path)
    return [Reference(line, *(_titled_cell(table, cells, column) for column in REFERENCE_COLUMNS))
            for line, cells in table.records if _titled_cell(table, cells, "Key")]


def _titled_cell(table: Category, cells, column: str) -> str:
    """A line's cell under a column found by its title anywhere in the header; blank where there is none."""
    if column not in table.columns:
        return ""
    index = table.columns.index(column)
    return cells[index] if index < len(cells) else ""


YEAR_RE = re.compile(r"^\d{4}$")


def work_of(reference: Reference) -> Optional[dict]:
    """Which work a reference says it is, in the shape tools/doi_lock.mjs compares.

    None when it names no Type. A field left blank is left out, not written
    empty, so the lock reports it missing by name rather than comparing an
    empty string. Authors are family names separated by semicolons, the
    separator Verified already uses, because a family name can hold a comma's
    worth of suffix ("Hall, Jr.") and a space.

    Raises ValueError for work fields with no Type - they would otherwise be
    dropped without a word - and for a Year that is not four digits, which the
    lock compares as a number.
    """
    fields = dict(zip(WORK_COLUMNS[1:], (reference.title, reference.authors, reference.year,
                                         reference.volume, reference.first_page, reference.publisher)))
    if not reference.type:
        given = [column for column, value in fields.items() if value]
        if given:
            raise ValueError(f"{', '.join(given)} given with no Type to say what kind of work they describe")
        return None
    if reference.year and not YEAR_RE.match(reference.year):
        raise ValueError(f"Year {reference.year!r} is not a year - write the four digits alone, like '1996'")

    work: dict = {"type": reference.type}
    if reference.title:
        work["title"] = reference.title
    authors = [name.strip() for name in reference.authors.split(";") if name.strip()]
    if authors:
        work["authors"] = authors
    if reference.year:
        work["year"] = int(reference.year)
    for key, value in (("volume", reference.volume), ("firstPage", reference.first_page),
                       ("publisher", reference.publisher)):
        if value:
            work[key] = value
    return work


#: The method's own error on a total, as a published figure: one row per quantity
#: it is published for. It is not any group's uncertainty, and not a sum of them
#: (D11) - the group values were fitted to whole molecules together, so their
#: errors are not independent and adding them up overstates the whole. Cited as
#: a row is, by a Source key into REFERENCES_PATH.
UNCERTAINTY_PATH = "data/uncertainty.csv"
#: The columns of UNCERTAINTY_PATH, found by title.
#:   Symbol    the quantity symbol of the totals it describes, as notation/categories.csv writes it
#:   Value     the figure as its source prints it, one unsigned number
#:   Unit      the unit it is printed in; blank is kJ/mol, as for a category
#:   Phase     the phase it was measured in, which the page's sentence names
#:   Elements  the element symbols of the compounds it was measured on, separated by spaces
#:   Source    a Key in REFERENCES_PATH
#:   Note      what a reader has to know to read the figure honestly
UNCERTAINTY_COLUMNS = ("Symbol", "Value", "Unit", "Phase", "Elements", "Source", "Note")

ELEMENT_RE = re.compile(r"^[A-Z][a-z]?$")


class MethodFigure(NamedTuple):
    """One row of UNCERTAINTY_PATH, as written. method_figure_problems() says whether it is usable."""

    line: int
    symbol: str
    value: str
    unit: str
    phase: str
    elements: str
    source: str
    note: str


def read_method_figures(path: str = UNCERTAINTY_PATH) -> list[MethodFigure]:
    """Every figure in file order, kept whether or not it is complete. An absent file means none.

    A line with nothing in any cell - a spreadsheet's trailing ",,,,,," - is not a figure.
    """
    if not os.path.exists(path):
        return []
    table = read_category(path)
    return [MethodFigure(line, *(_titled_cell(table, cells, column) for column in UNCERTAINTY_COLUMNS))
            for line, cells in table.records if any(cells)]


def method_figure_problems(figures: list[MethodFigure], references: list[Reference],
                           symbols: set[str]) -> list[tuple[int, str]]:
    """Everything that stops a figure being shown truthfully, as (line, message).

    `symbols` are the quantity symbols the categories declare. The build refuses
    on any of these and the validator reports them, from this one list, so the
    two cannot disagree about what a usable figure is.

    Every column is required. A figure with no Source is an uncited number in
    front of a student; one with no Note has lost the caveats that stop a fit
    statistic being read as a prediction interval; and the page's sentence names
    the phase, the quantity and the elements, so a blank there would print a
    claim with a hole in it.
    """
    known = {reference.key for reference in references}
    problems: list[tuple[int, str]] = []
    first_seen: dict[str, int] = {}
    for figure in figures:
        line = figure.line
        for column, value in zip(UNCERTAINTY_COLUMNS, figure[1:]):
            if not value and column != "Unit":
                problems.append((line, f"no {column}"))
        if figure.symbol:
            if figure.symbol not in symbols:
                problems.append((line, f"{figure.symbol!r} is not the Symbol of any category, "
                                       "so this figure would describe no total"))
            if figure.symbol in first_seen:
                problems.append((line, f"{figure.symbol!r} already has a figure on line {first_seen[figure.symbol]}"))
            else:
                first_seen[figure.symbol] = line
        try:
            read_uncertainty(figure.value)
        except ValueError as exc:
            problems.append((line, str(exc)))
        try:
            to_kj(0.0, figure.unit)
        except ValueError as exc:
            problems.append((line, str(exc)))
        for element in figure.elements.split():
            if not ELEMENT_RE.match(element):
                problems.append((line, f"Elements: {element!r} is not an element symbol"))
        if figure.source and figure.source not in known:
            problems.append((line, f"Source {figure.source!r} is not a key in {REFERENCES_PATH}"))
    return problems


def unresolved_sources(categories: list[Category], references: list[Reference]) -> list[tuple[str, int, Row]]:
    """Each row whose Source names no reference, as (file, line, row).

    A blank Source is not one of them. A row with no source recorded says so
    honestly; a Source naming nothing claims a citation nobody can find.
    """
    keys = {reference.key for reference in references}
    return [(category.file, line, row)
            for category in categories
            for line, row in category.numbered_rows
            if row.source and row.source not in keys]


