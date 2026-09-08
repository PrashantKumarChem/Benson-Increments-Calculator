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

from benson_data import CSV_DIR, MANIFEST_NAME, find_categories, manifest_for


def main() -> int:
    categories = find_categories()
    if not categories:
        print(f"No CSV files found in {CSV_DIR}/", file=sys.stderr)
        return 1

    manifest = manifest_for(categories)
    path = os.path.join(CSV_DIR, MANIFEST_NAME)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")

    for entry in manifest["categories"]:
        print(f"  {entry['file']:<32} {entry['count']:>3} rows  -> {entry['title']}")
    print(f"Wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
