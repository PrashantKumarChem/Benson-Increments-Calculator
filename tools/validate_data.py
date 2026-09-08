"""Validate the increment CSV files.

The README invites contributors to add a category by dropping a CSV into
CSV_data_files/. This is what checks such a file is usable before it reaches
anyone's browser. Run it locally or let CI run it on every push:

    python tools/validate_data.py
"""
from __future__ import annotations

import json
import os
import sys

from benson_data import (
    CSV_DIR,
    MANIFEST_NAME,
    Category,
    build_manifest_comparable,
    find_categories,
    parse_value,
)


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

    if build_manifest_comparable(categories) != build_manifest_comparable(committed):
        report.add(MANIFEST_NAME, 0, "does not match the CSV files on disk - "
                                     "run: python tools/build_data.py")


def main() -> int:
    categories = find_categories()
    if not categories:
        print(f"No CSV files found in {CSV_DIR}/", file=sys.stderr)
        return 1

    report = Report()
    for category in categories:
        check_category(category, report)
    check_manifest(categories, report)

    if report:
        print(f"{len(report.problems)} problem(s) found:\n", file=sys.stderr)
        for problem in report.problems:
            print(f"  {problem}", file=sys.stderr)
        return 1

    total = sum(len(c.rows) for c in categories)
    print(f"OK - {len(categories)} category files, {total} increments, manifest up to date.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
