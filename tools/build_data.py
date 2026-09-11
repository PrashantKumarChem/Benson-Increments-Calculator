"""Regenerate CSV_data_files/manifest.json.

A browser cannot list a directory the way glob.glob() can, so the site reads a
manifest to discover the categories. Run this after adding, removing or
renaming a CSV file; CI fails if the committed manifest is out of date.

    python tools/build_data.py
"""
from __future__ import annotations

import json
import os
import sys

# A quantity symbol may be non-ASCII, and the default Windows console encoding
# cannot print one. Reporting is not worth crashing a build over.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Run as a script, Python puts tools/ on the path and not the repository root,
# so the package is not importable until the root is added. First, so a checkout
# is always built by its own rules rather than by a copy installed elsewhere.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from benson.data import CSV_DIR, MANIFEST_NAME, find_categories, manifest_for, read_metadata


def main() -> int:
    categories = find_categories()
    if not categories:
        print(f"No CSV files found in {CSV_DIR}/", file=sys.stderr)
        return 1

    manifest = manifest_for(categories, read_metadata())
    path = os.path.join(CSV_DIR, MANIFEST_NAME)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")

    for entry in manifest["categories"]:
        described = entry["symbol"] or "-"
        print(f"  {entry['file']:<32} {entry['count']:>3} rows  {described:<6} -> {entry['title']}")
    print(f"Wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
