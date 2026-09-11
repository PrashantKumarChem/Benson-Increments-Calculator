"""Validate the increment CSV files.

The README invites contributors to add a category by dropping a CSV into
CSV_data_files/. This is what checks such a file is usable before it reaches
anyone's browser. Run it locally or let CI run it on every push:

    python tools/validate_data.py
"""
from __future__ import annotations

import csv
import json
import os
import sys

# Run as a script, Python puts tools/ on the path and not the repository root,
# so the package is not importable until the root is added. First, so a checkout
# is always checked by its own rules rather than by a copy installed elsewhere.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from benson.data import (
    CSV_DIR,
    MANIFEST_NAME,
    METADATA_FIELDS,
    METADATA_NAME,
    NOTATION_DIR,
    Category,
    build_manifest_comparable,
    find_categories,
    read_metadata,
    read_pairs,
)
from benson.notation import NOTATION_FILES, load_notation
from benson.values import is_range, parse_value

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

    if len(category.columns) != 2:
        report.add(name, 1, f"header has {len(category.columns)} columns, expected exactly 2 "
                            "(group name, then value in kJ/mol)")
        return

    if not all(category.columns):
        report.add(name, 1, "header has an empty column title")

    if not category.rows:
        report.add(name, 0, "file has a header but no data rows")
        return

    first_seen: dict[str, int] = {}
    for offset, row in enumerate(category.rows):
        line = offset + 2  # header is line 1

        if len(row) != 2:
            report.add(name, line, f"{len(row)} columns, expected 2 - a stray comma in the group name?")
            continue

        label, raw_value = row
        if not label:
            report.add(name, line, "missing group name")
        elif label in first_seen:
            report.add(name, line, f"{label!r} already appears on line {first_seen[label]}")
        else:
            first_seen[label] = line

        try:
            parse_value(raw_value)
        except ValueError as exc:
            report.add(name, line, f"{label or 'row'}: {exc}")

    # While a range was written with a hyphen, this combination was unreadable.
    # The notebook splits a string cell on the range separator, and pandas types
    # a whole column as strings as soon as one cell is a range - so a negative
    # sharing a file with a range arrived as "-42", split on its own minus sign,
    # and became float(""). The separator is now the word "to", which cannot be
    # a sign, and the notebook reads such a file correctly: checked by running
    # its own parse_value over one, through pandas.
    #
    # The rule is kept until the notebook stops reading the data with a parser of
    # its own. Two independent readings still exist, this is the one combination
    # that has already driven them apart, and no category mixes them today - so
    # holding the data inside what both are known to agree on costs nothing while
    # the rules are being moved into one place.
    written = [(offset + 2, row[0], row[1])
               for offset, row in enumerate(category.rows) if len(row) == 2]
    ranges = [(line, label) for line, label, raw in written if is_range(raw)]
    negatives = [(line, label) for line, label, raw in written
                 if not is_range(raw) and str(raw).strip().strip('"').startswith("-")]
    if ranges and negatives:
        report.add(name, ranges[0][0],
                   f"{ranges[0][1]!r} is a range, and {negatives[0][1]!r} on line "
                   f"{negatives[0][0]} is negative. Put them in separate category files. "
                   "The parser this protected has since been fixed; the restriction is held "
                   "only until the notebook stops reading the data with a parser of its own.")



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

    with open(path, encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))

    if not rows:
        report.add(METADATA_NAME, 0, "file is empty - delete it, or give it a header row")
        return

    header = [column.strip() for column in rows[0]]
    if not header or header[0] != "File":
        report.add(METADATA_NAME, 1, "the first column must be headed 'File'")
        return

    missing = [f.capitalize() for f in METADATA_FIELDS if f.capitalize() not in header]
    if missing:
        report.add(METADATA_NAME, 1,
                   f"header is missing {', '.join(missing)} - expected File, then "
                   + ", ".join(f.capitalize() for f in METADATA_FIELDS))

    for offset, row in enumerate(rows[1:]):
        line = offset + 2
        if not row or not row[0].strip():
            continue
        name = row[0].strip()

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


def check_manifest(categories: list[Category], report: Report) -> None:
    """The site reads the manifest instead of scanning the folder, so it must match."""
    path = os.path.join(CSV_DIR, MANIFEST_NAME)
    if not os.path.exists(path):
        report.add(MANIFEST_NAME, 0, "missing - run: python tools/build_data.py")
        return

    with open(path, encoding="utf-8") as handle:
        try:
            committed = json.load(handle)
        except json.JSONDecodeError as exc:
            report.add(MANIFEST_NAME, 0, f"is not valid JSON ({exc.msg})")
            return

    if build_manifest_comparable(categories, read_metadata()) != build_manifest_comparable(committed):
        report.add(MANIFEST_NAME, 0, "does not match the CSV files on disk - "
                                     "run: python tools/build_data.py")


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
    known = {label for category in categories for label, _ in category.rows}
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
        for offset, row in enumerate(category.rows):
            if len(row) != 2 or not row[0]:
                continue
            owner = seen.setdefault(row[0], category.file)
            if owner != category.file:
                report.add(category.file, offset + 2,
                           f"{row[0]!r} is already defined in {owner} - a group name has to be "
                           "unique across categories, not just within one file")


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
    check_manifest(categories, report)
    check_notation(categories, report)

    if report:
        print(f"{len(report.problems)} problem(s) found:\n", file=sys.stderr)
        for problem in report.problems:
            print(f"  {problem}", file=sys.stderr)
        return 1

    total = sum(len(c.rows) for c in categories)
    described = sum(1 for c in categories if read_metadata().get(c.file, {}).get("quantity"))
    print(f"OK - {len(categories)} category files ({described} described), {total} increments, "
          "manifest up to date, notation files consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
