"""Emitting the artifact the consumers read.

Applies the rules in this package to the source data and writes one JSON file
holding everything derived: each increment's kJ/mol value, its precision, its
range bounds, its notation decomposition and its precomputed search aliases,
plus the display factor for showing a total in kcal/mol.

The point of emitting the derived parts rather than the raw parts is that a
consumer then has no rule of its own to get wrong. A website that reads
`decimals` is not implementing a precision rule, and one that reads `aliases`
is not implementing notation decomposition. CI regenerates the artifact and
fails on any difference, which is the bargain the asset version already keeps
here.

**What this does not emit yet, and why.** `02-data-schema.md`'s sketch also
shows `uncertainty` and `references` blocks. Neither has a consumer before WP5
and WP6, and both need something this data does not have yet: `uncertainty`'s
figure is a chemistry judgement between candidate values (D11, H4) that is not
this package's to make, and `references` needs `data/references.csv`, which
does not exist until WP5. Emitting either now would be inventing an answer
ahead of the work that earns it. Per-increment `ref` and `uncertainty` are
skipped for the same reason.

The schema doc's `search` block is a map keyed by exact query text, which
cannot hold arbitrary typing. What is actually precomputed - each increment's
normalised search aliases, in the doc's `composition`/`central`/`ligands`
sense - is carried on the increment itself instead (D7 layer B). Turning a
keystroke into a score against those aliases, and sorting the results, is the
residue D7 layer C leaves in JavaScript; WP4's conformance fixture is where
that residue gets pinned.
"""
from __future__ import annotations

import glob
import hashlib
import json
import os
import sys

from benson.data import CSV_DIR, METADATA_FIELDS, NOTATION_DIR, find_categories, read_metadata
from benson.notation import build_index, load_notation
from benson.notation import read as read_notation
from benson.values import KJ_TO_KCAL_DISPLAY, read_value, to_kj

SCHEMA = 1
ARTIFACT_PATH = os.path.join("dist", "increments.json")


class BuildError(Exception):
    """The source data cannot be built into an artifact as it stands.

    validate_data.py is the tool a contributor runs to find out why; this is
    raised so the build never writes a JSON file that quietly shipped less than
    the data actually says.
    """


def _content_hash(csv_dir: str, notation_dir: str) -> str:
    """A hash of every source file the build reads - name and bytes both.

    Not a date and not a git SHA (see the module docstring's neighbour, D2):
    both would make the artifact depend on when or where it was built rather
    than on what it was built from, and CI's `git diff --exit-code` would then
    fail on a rebuild that changed nothing. A hash of the source content is a
    pure function of the data, so a clean checkout and CI's regeneration of it
    always agree.

    Only the basename goes into the digest, the same choice build_version.py
    already makes: CSV_DIR and NOTATION_DIR are relative by default, so this
    matters only for a caller that passes an absolute path (a test, mostly),
    but hashing one made the artifact depend on where the checkout happened to
    sit on disk, which a build input must not.
    """
    paths = sorted(glob.glob(os.path.join(csv_dir, "*.csv"))) + \
        sorted(glob.glob(os.path.join(notation_dir, "*.csv")))
    digest = hashlib.sha256()
    for path in paths:
        digest.update(os.path.basename(path).encode("utf-8"))
        digest.update(b"\0")
        with open(path, "rb") as handle:
            digest.update(handle.read())
        digest.update(b"\0")
    return digest.hexdigest()[:16]


def _category_entry(category, declared: dict) -> dict:
    unit = (declared.get("unit") or "").strip() or "kJ/mol"
    entry = {"file": category.file, "title": category.title, "unit": unit}
    entry.update({field: declared.get(field, "") for field in METADATA_FIELDS if field != "unit"})
    entry["count"] = len(category.rows)
    return entry


def _ligands_of(ligands) -> list[dict]:
    return [{"token": token, "count": count} for token, count in ligands]


def _increment_entry(entry, notation, unit: str) -> dict:
    """One row: its value in the unit the site sums, and its notation reading.

    `entry` is a benson.notation.Entry - one row of build_index(), which
    already carries the precomputed, normalised search aliases (D7 layer B).
    """
    reading = read_value(entry.row.value)
    decomposed = read_notation(entry.label, notation)
    return {
        "label": entry.label,
        "category": entry.category.file,
        "value": to_kj(reading.value, unit),
        "decimals": reading.decimals,
        "isRange": reading.is_range,
        "low": to_kj(reading.low, unit),
        "high": to_kj(reading.high, unit),
        # As printed, in the category's own unit - the provenance record a
        # converted "value" alone would lose.
        "source": reading.source,
        "unit": unit,
        "storedValue": reading.value,
        "kind": decomposed.kind,
        "composition": decomposed.atoms,
        "central": decomposed.central,
        "ligands": _ligands_of(decomposed.ligands),
        "reason": decomposed.reason,
        "aliases": list(entry.aliases),
        "synonyms": list(entry.synonyms),
    }


def build_artifact(csv_dir: str = CSV_DIR, notation_dir: str = NOTATION_DIR) -> dict:
    """Everything the consumers need, read from the source and derived once."""
    categories = find_categories(csv_dir)
    if not categories:
        raise BuildError(f"No CSV files found in {csv_dir}/")

    notation = load_notation(notation_dir)
    if notation.problems:
        # The page used to step over a malformed notation/ row in silence
        # (L16) and only the validator, run separately, ever said so. Once the
        # artifact is the site's only source that silence would ship a wrong
        # reading to every consumer, so the build refuses instead.
        problems = "\n".join(f"  {p.file}:{p.line}: {p.message}" for p in notation.problems)
        raise BuildError(f"{notation_dir}/ has {len(notation.problems)} problem(s):\n{problems}")

    metadata = read_metadata(notation_dir)
    categories_out = [_category_entry(category, metadata.get(category.file, {})) for category in categories]
    unit_by_file = {entry["file"]: entry["unit"] for entry in categories_out}

    index = build_index(categories, notation)
    increments_out = [_increment_entry(entry, notation, unit_by_file[entry.category.file]) for entry in index]

    return {
        "schema": SCHEMA,
        "generated_by": "benson/build.py - do not edit by hand",
        "content_hash": _content_hash(csv_dir, notation_dir),
        "display": {"kj_to_kcal": KJ_TO_KCAL_DISPLAY},
        "categories": categories_out,
        "increments": increments_out,
    }


def write_artifact(path: str = ARTIFACT_PATH, csv_dir: str = CSV_DIR, notation_dir: str = NOTATION_DIR) -> dict:
    artifact = build_artifact(csv_dir, notation_dir)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(artifact, handle, indent=2)
        handle.write("\n")
    return artifact


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    try:
        artifact = write_artifact()
    except BuildError as exc:
        print(f"Cannot build {ARTIFACT_PATH}:\n{exc}", file=sys.stderr)
        return 1
    print(f"Wrote {ARTIFACT_PATH} - {len(artifact['increments'])} increments "
          f"across {len(artifact['categories'])} categories.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
