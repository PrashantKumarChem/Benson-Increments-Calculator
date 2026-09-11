"""Export every increment value exactly as the notebook computes it.

This is the reference implementation the web version is being ported from: it
loads the CSVs with pandas and applies the notebook's own parse_value, read out
of the notebook file each time this runs. tools/check_parity.mjs compares this
output against what the browser code produces, so the port is proven value by
value instead of by spot-checking a few molecules.

Retire this together with the notebook.

    python tools/export_reference_values.py > reference.json
"""
from __future__ import annotations

import ast
import glob
import json
import os
import sys

import pandas as pd

NOTEBOOK = "Benson Increments Calculator.ipynb"


def notebook_parse_value(notebook_path: str = NOTEBOOK):
    """The notebook's parse_value, compiled from the notebook file itself.

    It used to be copied in here by hand, because a notebook is not importable.
    That made this the one place a notebook edit had to be repeated, and nothing
    noticed when it was not: the parity check would have gone on comparing the
    site against a reading nothing performs, and passing. Taking the function
    from the notebook leaves no copy to fall out of step.

    Only that one definition is compiled. The cell it sits in also imports
    ipywidgets and builds the interface, neither of which this script needs.

    It is deliberately not the benson package's rule. The site is being moved
    onto that package, so comparing the site against it would stop this being a
    comparison with the notebook - and would still pass.
    """
    with open(notebook_path, encoding="utf-8") as handle:
        cells = json.load(handle)["cells"]

    found = []
    for cell in cells:
        if cell.get("cell_type") != "code":
            continue
        source = cell.get("source", "")
        try:
            tree = ast.parse("".join(source) if isinstance(source, list) else source)
        except SyntaxError:
            # A cell holding IPython syntax (%pip, !ls) is not Python. If that is
            # where parse_value went, the count below says so.
            continue
        found += [node for node in tree.body
                  if isinstance(node, ast.FunctionDef) and node.name == "parse_value"]

    if len(found) != 1:
        raise SystemExit(
            f"{notebook_path}: expected exactly one top-level parse_value, found {len(found)}. "
            "The parity check compares the site against that function, so it cannot run without it.")

    namespace: dict = {}
    exec(compile(ast.Module(body=found, type_ignores=[]), notebook_path, "exec"), namespace)
    return namespace["parse_value"]


def main() -> int:
    parse_value = notebook_parse_value()
    exported = []
    for path in sorted(glob.glob(os.path.join("CSV_data_files", "*.csv"))):
        frame = pd.read_csv(path)
        frame.columns = frame.columns.str.strip()
        frame.fillna(0, inplace=True)
        if len(frame.columns) != 2:
            print(f"skipping {path}: not two columns", file=sys.stderr)
            continue

        group_column, value_column = frame.columns
        for _, row in frame.iterrows():
            group, raw = row[group_column], row[value_column]
            if pd.isna(group) or str(group).strip() == "":
                continue
            entry = {"file": os.path.basename(path), "label": str(group).strip()}
            try:
                entry["value"] = parse_value(raw)
            except Exception as exc:  # noqa: BLE001 - report, do not hide
                entry["error"] = f"{type(exc).__name__}: {exc}"
            exported.append(entry)

    json.dump({"source": "notebook", "values": exported}, sys.stdout, indent=None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
