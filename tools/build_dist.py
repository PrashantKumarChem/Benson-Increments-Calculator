"""Regenerate dist/increments.json, the artifact benson/build.py emits.

Run this after changing anything under CSV_data_files/ or notation/; CI
regenerates it independently and fails if the committed copy is out of date -
the same bargain the asset version already keeps in this repository.

    python tools/build_dist.py
"""
from __future__ import annotations

import os
import sys

# Run as a script, Python puts tools/ on the path and not the repository root,
# so the package is not importable until the root is added. First, so a
# checkout is always built by its own rules rather than by a copy installed
# elsewhere.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from benson.build import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
