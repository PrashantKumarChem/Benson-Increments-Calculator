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

`uncertainty` lists data/uncertainty.csv: for each quantity symbol, the
published figure for the method's own error on a whole total - in kJ/mol, with
the phase and the elements it was measured on, the key of the reference it is
from, and the note a reader needs to read it honestly. Which figure, and what
to say beside it, are chemistry and wording decisions (D11, H4), so they are
data with a citation rather than a constant here or in the page; the build only
carries them, and refuses a figure with anything missing.

A row's own `uncertainty` is not that figure, and is never summed into it (D11). It is the ± the row's source
prints, from the optional Uncertainty column, converted to kJ/mol as its value
is; like `verified`, `note` and `ref`, it is null wherever its column is blank.
`references` lists data/references.csv in file order, numbered by that order,
and a row's `ref` is the key of the reference its Source names.

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

from benson.data import (
    CSV_DIR,
    METADATA_FIELDS,
    NOTATION_DIR,
    REFERENCES_PATH,
    UNCERTAINTY_PATH,
    find_categories,
    method_figure_problems,
    read_metadata,
    read_method_figures,
    read_references,
    unresolved_sources,
    work_of,
)
from benson.notation import build_index, load_notation
from benson.notation import read as read_notation
from benson.values import KJ_TO_KCAL_DISPLAY, read_uncertainty, read_value, to_kj

SCHEMA = 1
ARTIFACT_PATH = os.path.join("dist", "increments.json")


class BuildError(Exception):
    """The source data cannot be built into an artifact as it stands.

    validate_data.py is the tool a contributor runs to find out why; this is
    raised so the build never writes a JSON file that quietly shipped less than
    the data actually says.
    """


def _content_hash(csv_dir: str, notation_dir: str, references_path: str, uncertainty_path: str) -> str:
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
        sorted(glob.glob(os.path.join(notation_dir, "*.csv"))) + \
        [path for path in [references_path, uncertainty_path] if os.path.exists(path)]
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


def _increment_entry(entry, notation, category_unit: str) -> dict:
    """One row: its value in the unit the site sums, and its notation reading.

    `entry` is a benson.notation.Entry - one row of build_index(), which
    already carries the precomputed, normalised search aliases (D7 layer B).
    """
    row = entry.row
    # D18: a row's own Unit overrides its category's, for a file whose sources
    # print different units. One conversion either way; only its argument differs.
    unit = row.unit or category_unit
    reading = read_value(row.value)
    decomposed = read_notation(entry.label, notation)
    return {
        "label": entry.label,
        "category": entry.category.file,
        "value": to_kj(reading.value, unit),
        "decimals": reading.decimals,
        "isRange": reading.is_range,
        "low": to_kj(reading.low, unit),
        "high": to_kj(reading.high, unit),
        # As printed, in the row's own unit - the provenance record a
        # converted "value" alone would lose.
        "source": reading.source,
        "unit": unit,
        "storedValue": reading.value,
        # The ± the row's source prints, converted as its value is. A blank
        # optional cell is null rather than absent, as low and high are, so
        # every increment carries the same keys.
        "uncertainty": to_kj(read_uncertainty(row.uncertainty), unit),
        # The key, not a number: a reference's number is its place in the
        # artifact's references, so it is stated once, there.
        "ref": row.source or None,
        "verified": row.verified or None,
        "note": row.note or None,
        "kind": decomposed.kind,
        "composition": decomposed.atoms,
        "central": decomposed.central,
        "ligands": _ligands_of(decomposed.ligands),
        "reason": decomposed.reason,
        "aliases": list(entry.aliases),
        "synonyms": list(entry.synonyms),
    }


def _uncertainty_entry(figure) -> dict:
    """One method figure, converted as an increment's value is (D18), with what the page says beside it."""
    unit = figure.unit or "kJ/mol"
    reading = read_value(figure.value)
    return {
        "symbol": figure.symbol,
        "value": to_kj(read_uncertainty(figure.value), unit),
        "decimals": reading.decimals,
        "unit": unit,
        "storedValue": reading.value,
        "phase": figure.phase,
        "elements": figure.elements.split(),
        "ref": figure.source,
        "note": figure.note,
    }


def build_artifact(csv_dir: str = CSV_DIR, notation_dir: str = NOTATION_DIR,
                   references_path: str = REFERENCES_PATH, uncertainty_path: str = UNCERTAINTY_PATH) -> dict:
    """Everything the consumers need, read from the source and derived once."""
    categories = find_categories(csv_dir)
    if not categories:
        raise BuildError(f"No CSV files found in {csv_dir}/")

    # A group name keys everything that annotates it from outside CSV_DIR - a
    # source, an uncertainty, a synonym - so two rows sharing one, whether in
    # the same file or two different ones, would make such a row ambiguous
    # about which it describes, and build_index() would silently carry both
    # into the artifact as if they were unrelated increments.
    # tools/validate_data.py's check_category() and check_unique_names()
    # already report the within-file and across-file cases respectively, and
    # always run first in this repository's own pipeline - guarded here too,
    # the same reason build_artifact()'s other refusals do not rely on that
    # ordering: it is a public function a caller can call on its own.
    files_by_label: dict[str, list[str]] = {}
    for category in categories:
        for row in category.rows:
            files_by_label.setdefault(row.group, []).append(category.file)
    duplicates = sorted((label, files) for label, files in files_by_label.items() if len(files) > 1)
    if duplicates:
        problems = "\n".join(f"  {label!r} appears in {', '.join(files)}" for label, files in duplicates)
        raise BuildError(f"{len(duplicates)} duplicate group name(s):\n{problems}")

    references = read_references(references_path)
    unresolved = unresolved_sources(categories, references)
    if unresolved:
        # A ref naming no reference would reach a page as a citation mark that
        # points at nothing. validate_data.py reports it; the build refuses as
        # well, so that a local rebuild cannot write one either.
        problems = "\n".join(f"  {file}:{line}: {row.group}: Source {row.source!r}"
                             for file, line, row in unresolved)
        raise BuildError(f"{len(unresolved)} Source(s) name no key in {references_path}:\n{problems}")

    notation = load_notation(notation_dir)
    if notation.problems:
        # The page used to step over a malformed notation/ row in silence
        # (L16) and only the validator, run separately, ever said so. Once the
        # artifact is the site's only source that silence would ship a wrong
        # reading to every consumer, so the build refuses instead.
        problems = "\n".join(f"  {p.file}:{p.line}: {p.message}" for p in notation.problems)
        raise BuildError(f"{notation_dir}/ has {len(notation.problems)} problem(s):\n{problems}")

    works = {}
    for reference in references:
        try:
            works[reference.key] = work_of(reference)
        except ValueError as exc:
            # A work the lock cannot read would reach it as no work at all, and a
            # DOI with no work is refused there under a message about something else.
            raise BuildError(f"{references_path}:{reference.line}: {reference.key}: {exc}") from exc

    metadata = read_metadata(notation_dir)
    categories_out = [_category_entry(category, metadata.get(category.file, {})) for category in categories]
    unit_by_file = {entry["file"]: entry["unit"] for entry in categories_out}

    figures = read_method_figures(uncertainty_path)
    symbols = {entry["symbol"] for entry in categories_out if entry["symbol"]}
    figure_problems = method_figure_problems(figures, references, symbols)
    if figure_problems:
        # A figure is printed under a student's total as a claim about it. One
        # missing its source, its caveats or what it applies to is refused
        # rather than shown with a hole in it.
        problems = "\n".join(f"  {uncertainty_path}:{line}: {message}" for line, message in figure_problems)
        raise BuildError(f"{uncertainty_path} has {len(figure_problems)} problem(s):\n{problems}")

    index = build_index(categories, notation)
    increments_out = []
    for entry in index:
        try:
            increments_out.append(_increment_entry(entry, notation, unit_by_file[entry.category.file]))
        except ValueError as exc:
            # tools/validate_data.py already refuses an unreadable value or
            # unit before this ever runs, in the pipeline every check uses -
            # but build_artifact() is a public function, callable on its own
            # (a notebook's bring-your-own-data path does exactly that), so it
            # cannot assume that check already ran. Without this, a truncated
            # range or an unconvertible Unit reached the caller as a raw
            # InvalidValueError/ValueError instead of this function's own
            # BuildError, breaking the one promise every other refusal here
            # keeps: a clean, located message.
            raise BuildError(f"{entry.category.file}: {entry.label!r}: {exc}") from exc

    try:
        uncertainty_out = [_uncertainty_entry(figure) for figure in figures]
    except ValueError as exc:
        # method_figure_problems() above already validates each figure's value
        # and unit, so this should be unreachable in practice - guarded anyway
        # rather than resting on that ordering, for the same reason as above.
        raise BuildError(f"{uncertainty_path}: {exc}") from exc

    return {
        "schema": SCHEMA,
        "generated_by": "benson/build.py - do not edit by hand",
        "content_hash": _content_hash(csv_dir, notation_dir, references_path, uncertainty_path),
        "display": {"kj_to_kcal": KJ_TO_KCAL_DISPLAY},
        "categories": categories_out,
        # Numbered by their order in the file, here and nowhere else.
        "references": [
            {"number": number, "key": reference.key, "citation": reference.citation,
             "doi": reference.doi or None, "work": works[reference.key]}
            for number, reference in enumerate(references, start=1)
        ],
        "uncertainty": uncertainty_out,
        "increments": increments_out,
    }


def write_artifact(path: str = ARTIFACT_PATH, csv_dir: str = CSV_DIR, notation_dir: str = NOTATION_DIR,
                   references_path: str = REFERENCES_PATH, uncertainty_path: str = UNCERTAINTY_PATH) -> dict:
    artifact = build_artifact(csv_dir, notation_dir, references_path, uncertainty_path)
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
