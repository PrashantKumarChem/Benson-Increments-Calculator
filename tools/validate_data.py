"""Validate the increment CSV files.

The README invites contributors to add a category by dropping a CSV into
CSV_data_files/. This is what checks such a file is usable before it reaches
anyone's browser. Run it locally or let CI run it on every push:

    python tools/validate_data.py
"""
from __future__ import annotations

import os
import sys

# Run as a script, Python puts tools/ on the path and not the repository root,
# so the package is not importable until the root is added. First, so a checkout
# is always checked by its own rules rather than by a copy installed elsewhere.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from benson.data import (
    CSV_DIR,
    METADATA_FIELDS,
    METADATA_NAME,
    NOTATION_DIR,
    OPTIONAL_COLUMNS,
    REFERENCES_PATH,
    REFERENCE_COLUMNS,
    UNCERTAINTY_COLUMNS,
    UNCERTAINTY_PATH,
    Category,
    find_categories,
    method_figure_problems,
    read_category,
    read_metadata,
    read_method_figures,
    read_pairs,
    read_references,
    unresolved_sources,
    work_of,
)
from benson.notation import NOTATION_FILES, load_notation
from benson.values import read_uncertainty, read_value, to_kj

# A quantity symbol may be non-ASCII, and the default Windows console encoding
# cannot print one. Reporting a problem must not itself become one.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")


class Report:
    """Collects problems so one run reports everything, not just the first fault."""

    def __init__(self) -> None:
        self.problems: list[str] = []

    def add(self, where: str, line: int, message: str) -> None:
        location = f"{where}:{line}" if line else where
        self.problems.append(f"{location}: {message}")

    def __bool__(self) -> bool:
        return bool(self.problems)


def check_category(category: Category, report: Report) -> None:
    name = category.file

    if not category.has_valid_name:
        report.add(name, 0, "filename should look like 01_Category_Name.csv - two digits, "
                            "an underscore, then the category name as it should be displayed")

    if not category.columns:
        report.add(name, 0, "file is empty")
        return

    if len(category.columns) < 2:
        report.add(name, 1, "header has one column, expected at least two (group name, then value)")
        return

    if not all(category.columns):
        report.add(name, 1, "header has an empty column title")

    # The reader finds an optional column by its exact title and ignores any
    # other, so a misspelt one would drop what it holds without a word. That is
    # the silent kind of fault, and the one worth refusing by name.
    optional = category.columns[2:]
    for column in dict.fromkeys(optional):
        if column and column not in OPTIONAL_COLUMNS:
            report.add(name, 1, f"header column {column!r} is not one a category file can carry - after "
                                f"the group name and value, a column is one of {', '.join(OPTIONAL_COLUMNS)}")
        elif column and optional.count(column) > 1:
            report.add(name, 1, f"header names {column!r} more than once")

    if not category.records:
        report.add(name, 0, "file has a header but no data rows")
        return

    first_seen: dict[str, int] = {}
    for line, row in category.records:
        # A line with no comma at all is missing one, not carrying a stray one;
        # the site says so in the same words. Only when there is no comma: a comma
        # inside quotes still makes one cell here, and "no comma" would contradict
        # a line the contributor can see holds one.
        if len(row) == 1 and "," not in row[0]:
            report.add(name, line, "no comma - expected two columns")
            continue
        if not 2 <= len(row) <= category.width:
            expected = "2" if category.width == 2 else f"2 to {category.width}"
            report.add(name, line, f"{len(row)} columns, expected {expected} - a stray comma in the group name?")
            continue

        label, raw_value = row[0], row[1]
        if not label:
            report.add(name, line, "missing group name")
        elif label in first_seen:
            report.add(name, line, f"{label!r} already appears on line {first_seen[label]}")
        else:
            first_seen[label] = line

        # The build converts with both of these, so a Unit it cannot convert or
        # an Uncertainty that is not a number would stop it with a traceback
        # rather than a line a contributor can act on. Each asks the package's
        # own rule rather than restating it.
        unit = category.cell(row, "Unit")
        if unit:
            try:
                to_kj(0.0, unit)
            except ValueError as exc:
                report.add(name, line, f"{label or 'row'}: {exc}")
        try:
            read_uncertainty(category.cell(row, "Uncertainty"))
        except ValueError as exc:
            report.add(name, line, f"{label or 'row'}: {exc}")

        try:
            read_value(raw_value)
        except ValueError as exc:
            report.add(name, line, f"{label or 'row'}: {exc}")
            continue

    # A file mixing a range and a negative used to be unreadable by the
    # notebook's own pandas-based parser (H3): a hyphen range typed the whole
    # column as strings, so a negative sharing the file split on its own minus
    # sign and became float(""). WP1's "to" separator fixed the parser itself,
    # and WP7 archived the notebook that ran it (Archives/), so nothing live
    # reads this data any other way than benson.values.read_value does here -
    # there is no second reading left to drive apart. The guard that held the
    # data inside what both readers agreed on is retired with it.


def check_metadata(categories: list[Category], report: Report) -> None:
    """notation/categories.csv, which says what each category's numbers are.

    The file is optional and every column but the filename may be left blank -
    a category nobody has described yet is an ordinary state, and the site
    falls back to showing an unlabelled total rather than guessing. So the only
    faults worth reporting are the ones that outlast an edit: a row pointing at
    a file that no longer exists, and the same file described twice.

    The first is the check that will actually fire. It is the same fault
    synonyms.csv can develop, and it is checked here the same way, because a
    rename is silent otherwise: the row simply stops applying and the category
    quietly loses its heading.
    """
    path = os.path.join(NOTATION_DIR, METADATA_NAME)
    if not os.path.exists(path):
        return

    known = {category.file for category in categories}
    seen: dict[str, int] = {}

    # Read as a category file is, so each row is numbered where it starts. A note
    # quoted across a line break makes one row two lines, and counting rows
    # instead put every later fault a line early.
    metadata = read_category(path)

    if not metadata.columns and not metadata.records:
        report.add(METADATA_NAME, 0, "file is empty - delete it, or give it a header row")
        return

    header = metadata.columns
    if not header or header[0] != "File":
        report.add(METADATA_NAME, 1, "the first column must be headed 'File'")
        return

    missing = [f.capitalize() for f in METADATA_FIELDS if f.capitalize() not in header]
    if missing:
        report.add(METADATA_NAME, 1,
                   f"header is missing {', '.join(missing)} - expected File, then "
                   + ", ".join(f.capitalize() for f in METADATA_FIELDS))

    for line, row in metadata.records:
        if not row[0]:
            continue
        name = row[0]

        if name not in known:
            report.add(METADATA_NAME, line,
                       f"{name!r} is not a category in {CSV_DIR}/ - was it renamed?")
        if name in seen:
            report.add(METADATA_NAME, line, f"{name!r} is already described on line {seen[name]}")
        else:
            seen[name] = line

        if len(row) > len(header):
            report.add(METADATA_NAME, line,
                       f"{len(row)} columns, expected {len(header)} - an unquoted comma in the note?")


def check_notation(categories: list[Category], report: Report) -> None:
    """The notation files say what the group names are made of.

    What each file may hold - a composition written as element symbols, a key
    answered once, 'unknown' only where a composition is still open - is the
    package's rule, applied as it loads them, and this reports every row it
    refused. The one added here needs the data as well as the files, and is the
    one that will actually fire: a file still pointing at a group that has since
    been renamed. Whether a name can be read at all is a question about both the
    data and the parser, so the notation tests ask it.
    """
    known = {row.group for category in categories for row in category.rows}
    problems = []
    for spec in NOTATION_FILES:
        path = os.path.join(NOTATION_DIR, spec.name)
        if not spec.keys_are_groups or not os.path.exists(path):
            continue
        for line, key, value in read_pairs(path):
            # A row with no key or no value has been reported by the loader already.
            if key and value and key not in known:
                problems.append((spec.name, line, f"{key!r} is not a group in {CSV_DIR}/ - was it renamed?"))
    problems += load_notation().problems

    # File by file and line by line, as a contributor reads them - not every
    # refused row and then every renamed group. The sort is stable, so on one
    # line a renamed group still comes before what else is wrong with the row.
    order = {spec.name: index for index, spec in enumerate(NOTATION_FILES)}
    for file, line, message in sorted(problems, key=lambda problem: (order.get(problem[0], len(order)),
                                                                     problem[1])):
        report.add(file, line, message)


def check_unique_names(categories: list[Category], report: Report) -> None:
    """A group name must identify one increment across the whole data set.

    check_category already rejects a name repeated inside one file. This is the
    wider rule: anything that annotates a group from outside CSV_DIR - a source,
    an uncertainty, a synonym - can only key on the name, so the same name in
    two categories would make such a row ambiguous about which it describes.
    No two categories share a name today, and this is what keeps it that way.
    """
    seen: dict[str, str] = {}
    for category in categories:
        for line, row in category.numbered_rows:
            owner = seen.setdefault(row.group, category.file)
            if owner != category.file:
                report.add(category.file, line,
                           f"{row.group!r} is already defined in {owner} - a group name has to be "
                           "unique across categories, not just within one file")


def check_references(categories: list[Category], report: Report) -> None:
    """data/references.csv, and every row's Source against it.

    A Source is a key, not a citation, so the fault that matters is a key that
    names nothing: the row then claims a source nobody can look up. In the file
    itself, only what would make a key ambiguous or a reference empty is
    checked here. Whether a citation is right is not something a validator
    can know - see .claude/rules/citations.md.
    """
    name = os.path.basename(REFERENCES_PATH)
    references = read_references(REFERENCES_PATH)

    if os.path.exists(REFERENCES_PATH):
        # Read as a category file is, so each line is numbered where it starts.
        table = read_category(REFERENCES_PATH)
        missing = [column for column in REFERENCE_COLUMNS if column not in table.columns]
        if missing:
            report.add(name, 1, f"header is missing {', '.join(missing)} - expected "
                                f"{','.join(REFERENCE_COLUMNS)}")
        keyed = {reference.line for reference in references}
        for line, cells in table.records:
            if len(cells) > len(table.columns):
                report.add(name, line, f"{len(cells)} columns, expected {len(table.columns)} - "
                                       "an unquoted comma in the citation?")
            elif line not in keyed:
                report.add(name, line, "no Key - nothing can name this reference")

        first_seen: dict[str, int] = {}
        for reference in references:
            if reference.key in first_seen:
                report.add(name, reference.line,
                           f"{reference.key!r} is already a key on line {first_seen[reference.key]}")
            else:
                first_seen[reference.key] = reference.line
            if not reference.citation:
                report.add(name, reference.line, f"{reference.key!r} has no citation")
            # Whether the work fields agree with the citation and with the DOI's
            # record is the lock's to say (tools/doi_lock.mjs). What is checked
            # here is only what would stop the build from reading them at all.
            try:
                work_of(reference)
            except ValueError as exc:
                report.add(name, reference.line, f"{reference.key!r}: {exc}")

    for file, line, row in unresolved_sources(categories, references):
        report.add(file, line, f"{row.group}: Source {row.source!r} is not a key in {REFERENCES_PATH}")


def check_uncertainty(categories: list[Category], report: Report) -> None:
    """data/uncertainty.csv, the method's own error on a total.

    What makes a figure usable is benson.data.method_figure_problems(), which
    the build refuses on too, so the two cannot disagree. Only the file's shape
    is checked here as well.
    """
    if not os.path.exists(UNCERTAINTY_PATH):
        return
    name = os.path.basename(UNCERTAINTY_PATH)
    table = read_category(UNCERTAINTY_PATH)
    missing = [column for column in UNCERTAINTY_COLUMNS if column not in table.columns]
    if missing:
        report.add(name, 1, f"header is missing {', '.join(missing)} - expected {','.join(UNCERTAINTY_COLUMNS)}")
    for line, cells in table.records:
        if len(cells) > len(table.columns):
            report.add(name, line, f"{len(cells)} columns, expected {len(table.columns)} - "
                                   "an unquoted comma in the note?")

    # The symbols the build sees: those declared for a category that exists.
    metadata = read_metadata()
    symbols = {metadata.get(category.file, {}).get("symbol") for category in categories} - {"", None}
    for line, message in method_figure_problems(read_method_figures(), read_references(), symbols):
        report.add(name, line, message)


def main() -> int:
    categories = find_categories()
    if not categories:
        print(f"No CSV files found in {CSV_DIR}/", file=sys.stderr)
        return 1

    report = Report()
    for category in categories:
        check_category(category, report)
    check_unique_names(categories, report)
    check_metadata(categories, report)
    check_notation(categories, report)
    check_references(categories, report)
    check_uncertainty(categories, report)

    if report:
        print(f"{len(report.problems)} problem(s) found:\n", file=sys.stderr)
        for problem in report.problems:
            print(f"  {problem}", file=sys.stderr)
        return 1

    total = sum(len(c.rows) for c in categories)
    described = sum(1 for c in categories if read_metadata().get(c.file, {}).get("quantity"))
    cited = sum(1 for c in categories for row in c.rows if row.source)
    print(f"OK - {len(categories)} category files ({described} described), {total} increments "
          f"({cited} with a Source), {len(read_references())} references, "
          f"{len(read_method_figures())} method uncertainty figure(s), notation files consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
