"""Export every increment value exactly as the notebook computes it.

This is the reference implementation the web version is being ported from. The
loading and the parsing are both the notebook's own code - load_increment_data,
get_value_dicts and parse_value - read out of the notebook file each time this
runs. tools/check_parity.mjs compares this output against what the browser code
produces, so the port is proven value by value instead of by spot-checking a
few molecules.

Retire this together with the notebook.

    python tools/export_reference_values.py > reference.json
"""
from __future__ import annotations

import ast
import contextlib
import glob
import json
import os
import sys

import pandas as pd

NOTEBOOK = "Benson Increments Calculator.ipynb"
# The folder the notebook's main() hands to load_increment_data.
DATA_FOLDER = "CSV_data_files/"
NOTEBOOK_FUNCTIONS = ("load_increment_data", "get_value_dicts", "parse_value")


def notebook_functions(notebook_path: str = NOTEBOOK) -> dict:
    """The notebook's loading and parsing functions, compiled from the notebook file.

    parse_value used to be copied in here by hand, because a notebook is not
    importable, and the loading was written out again with small differences -
    the group names were trimmed, which the notebook does not do. Each was a
    place a notebook edit had to be repeated, and nothing noticed when it was
    not: the parity check went on comparing the site against a reading nothing
    performs, and passing. Taking the functions from the notebook leaves no copy
    to fall out of step.

    Only those definitions are compiled. The cell they sit in also imports
    ipywidgets and builds the interface, neither of which this script needs, so
    the modules they use are supplied under the names the notebook imports them
    as. If the notebook renames one, the export stops with a NameError rather
    than reading the data some other way.

    It is deliberately not the benson package's rule. The site is being moved
    onto that package, so comparing the site against it would stop this being a
    comparison with the notebook - and would still pass.
    """
    with open(notebook_path, encoding="utf-8") as handle:
        cells = json.load(handle)["cells"]

    found: dict[str, list[ast.FunctionDef]] = {name: [] for name in NOTEBOOK_FUNCTIONS}
    for cell in cells:
        if cell.get("cell_type") != "code":
            continue
        source = cell.get("source", "")
        try:
            tree = ast.parse("".join(source) if isinstance(source, list) else source)
        except SyntaxError:
            # A cell holding IPython syntax (%pip, !ls) is not Python. If that is
            # where one of the functions went, the count below says so.
            continue
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name in found:
                found[node.name].append(node)

    for name, definitions in found.items():
        if len(definitions) != 1:
            raise SystemExit(
                f"{notebook_path}: expected exactly one top-level {name}, found {len(definitions)}. "
                "The parity check compares the site against the notebook's own reading of the data, "
                "so it cannot run without it.")

    namespace: dict = {"pd": pd, "glob": glob, "os": os}
    module = ast.Module(body=[definitions[0] for definitions in found.values()], type_ignores=[])
    exec(compile(module, notebook_path, "exec"), namespace)
    return {name: namespace[name] for name in NOTEBOOK_FUNCTIONS}


def main() -> int:
    notebook = notebook_functions()
    # The notebook reports a file it cannot load, or one without two columns,
    # with print(). Here stdout is the JSON, so the warnings go to stderr.
    with contextlib.redirect_stdout(sys.stderr):
        categories = notebook["get_value_dicts"](notebook["load_increment_data"](DATA_FOLDER))

    exported = []
    # The notebook takes the files in whatever order the folder lists them; the
    # comparison does not depend on order, but a reproducible output is easier
    # to diff.
    for category_name in sorted(categories):
        for label, raw in categories[category_name].items():
            entry = {"file": f"{category_name}.csv", "label": label}
            try:
                entry["value"] = notebook["parse_value"](raw)
            except Exception as exc:  # noqa: BLE001 - report, do not hide
                entry["error"] = f"{type(exc).__name__}: {exc}"
            exported.append(entry)

    json.dump({"source": "notebook", "values": exported}, sys.stdout, indent=None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
