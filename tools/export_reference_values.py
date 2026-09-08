"""Export every increment value exactly as the notebook computes it.

This is the reference implementation the web version is being ported from: it
loads the CSVs with pandas and applies the notebook's own parse_value, rather
than the tidied rules in benson_data.py. tools/check_parity.mjs compares this
output against what the browser code produces, so the port is proven value by
value instead of by spot-checking a few molecules.

Retire this together with the notebook.

    python tools/export_reference_values.py > reference.json
"""
from __future__ import annotations

import glob
import json
import os
import sys

import pandas as pd


def notebook_parse_value(v):
    """Verbatim from 'Benson Increments Calculator.ipynb' - warts included.

    Splitting on any dash mis-reads a negative written as text; that never fires
    on the current data because pandas hands those columns over as numbers. It
    is reproduced here so the comparison is against what the notebook really
    does, not a tidied version of it.
    """
    if isinstance(v, str):
        v = v.strip()
        if '-' in v:
            parts = v.split('-')
            return (float(parts[0]) + float(parts[1])) / 2
        else:
            return float(v)
    else:
        return float(v)


def main() -> int:
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
                entry["value"] = notebook_parse_value(raw)
            except Exception as exc:  # noqa: BLE001 - report, do not hide
                entry["error"] = f"{type(exc).__name__}: {exc}"
            exported.append(entry)

    json.dump({"source": "notebook", "values": exported}, sys.stdout, indent=None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
