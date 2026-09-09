"""Shared reading and parsing for the increment data.

Both the manifest generator and the validator import this, so the rules for
"what is a category file" and "what is a valid value" are defined exactly once.
The browser applies the same rules in assets/benson.js; tools/check_parity.mjs
asserts that the two implementations agree on every value in the data set.
"""
from __future__ import annotations

import csv
import glob
import os
import re
from dataclasses import dataclass, field

CSV_DIR = "CSV_data_files"
MANIFEST_NAME = "manifest.json"
# Hand-edited, and optional: what a category's numbers are, and where they came
# from. A category with no row here still works and shows exactly what it always
# showed, so dropping a CSV into CSV_DIR remains the whole of adding one.
#
# It lives in NOTATION_DIR rather than beside the increments, because that
# folder is for what the data means rather than for the data. Keeping CSV_DIR
# to nothing but two-column increment files is not tidiness: the notebook globs
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

# "C", "N O2", "C2" - element symbols separated by spaces, each with an
# optional count. assets/notation.js reads compositions by the same rule.
COMPOSITION_RE = re.compile(r"^[A-Z][a-z]?\d*(?:\s+[A-Z][a-z]?\d*)*$")

NUMBER_RE = re.compile(r"^-?\d*\.?\d+$")
# "1.05-1.76" is a published range and is averaged. The dash is only a range
# separator between two numbers, so a leading minus stays a negative number.
RANGE_RE = re.compile(r"^(-?\d*\.?\d+)\s*-\s*(-?\d*\.?\d+)$")


class ValueError_(ValueError):
    """A cell that is neither a number nor a range."""


def parse_value(raw: str) -> float:
    """Turn a cell into kJ/mol. Ranges are averaged; negatives are preserved."""
    text = str(raw).strip().strip('"')
    if not text:
        raise ValueError_("empty value")
    match = RANGE_RE.match(text)
    if match:
        return (float(match.group(1)) + float(match.group(2))) / 2
    if NUMBER_RE.match(text):
        return float(text)
    raise ValueError_(f"{text!r} is neither a number nor a range like 1.05-1.76")


def title_for(stem: str) -> str:
    """01_CH_Groups -> 'CH Groups'.

    The casing a contributor writes in the filename is the casing shown in the
    tab, so no list of chemical acronyms has to live in the code: CH stays CH
    because it was already written that way.
    """
    match = FILENAME_RE.match(stem + ".csv")
    name = match.group(2) if match else stem
    return " ".join(name.split("_"))


@dataclass
class Category:
    """One CSV file: its identity on disk and the rows it holds."""

    path: str
    columns: list[str] = field(default_factory=list)
    rows: list[tuple[str, str]] = field(default_factory=list)

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
        raw = list(csv.reader(handle))
    if not raw:
        return Category(path=path)
    header = [c.strip() for c in raw[0]]
    rows = [tuple(c.strip() for c in row[:2]) for row in raw[1:] if row and row[0].strip()]
    return Category(path=path, columns=header, rows=rows)


def read_pairs(path: str):
    """Read a two-column file as (line number, key, value).

    Split on the last comma, which is what assets/notation.js does, so a group
    name may contain a comma even though a value may not.
    """
    with open(path, encoding="utf-8-sig") as handle:
        for offset, line in enumerate(handle.read().splitlines()[1:]):
            if not line.strip():
                continue
            key, comma, value = line.rpartition(",")
            if not comma:
                yield offset + 2, line.strip(), ""
            else:
                yield offset + 2, key.strip().strip('"'), value.strip()


def read_metadata() -> dict[str, dict[str, str]]:
    """What each category holds, keyed by filename. Absent file means no metadata.

    Read with the csv module rather than by splitting on commas, because unlike
    the increment files this one has six columns and a note that may contain
    prose. Unknown columns are ignored so a contributor can annotate the file
    without breaking it; missing ones read as blank.
    """
    path = os.path.join(NOTATION_DIR, METADATA_NAME)
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


def manifest_for(categories: list[Category], metadata: dict | None = None) -> dict:
    """The category index the site reads in place of scanning the folder.

    `columns` stays as it was: it records the header a contributor actually
    typed, which is provenance. The metadata fields record what those numbers
    mean, which is a different question. Both are written for every category,
    blank where nothing has been declared, so a built manifest and a committed
    one differ by value rather than by which keys are present.
    """
    metadata = metadata or {}
    entries = []
    for category in categories:
        declared = metadata.get(category.file, {})
        entry = {
            "file": category.file,
            "title": category.title,
            "columns": category.columns,
            "count": len(category.rows),
        }
        entry.update({field: declared.get(field, "") for field in METADATA_FIELDS})
        entries.append(entry)

    return {
        "_comment": "Generated by tools/build_data.py - do not edit by hand.",
        "categories": entries,
    }


def build_manifest_comparable(source: list[Category] | dict,
                              metadata: dict | None = None) -> list[tuple]:
    """Normalise a manifest - built or committed - so the two can be compared.

    The metadata fields are compared too, so editing categories.csv without
    regenerating the manifest is caught the same way as adding a CSV without
    regenerating it.
    """
    entries = (manifest_for(source, metadata)["categories"]
               if isinstance(source, list) else source.get("categories", []))
    return [
        (
            e.get("file"),
            e.get("title"),
            tuple(e.get("columns") or ()),
            e.get("count"),
            *(e.get(field, "") for field in METADATA_FIELDS),
        )
        for e in entries
    ]
