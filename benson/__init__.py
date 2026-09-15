"""The Benson group-additivity data rules, written once.

The calculator exists twice — a static website and a Jupyter notebook —
running in two engines that cannot share code. Before this package existed,
each had its own implementation of the same rules and `tools/check_parity.mjs`
checked the two agreed on the data that happened to exist; that check could
not prove they agreed on data that did not exist yet, and eventually they
disagreed. This package is what replaced it: the rules live here, in Python,
and everything else consumes them. `benson.build` emits the generated artifact
(`dist/increments.json`) the website fetches and stops parsing entirely; the
notebook imports this package directly, which is also what lets a student
load their own file under identical rules — the same `benson.build.
build_artifact()` the curated data is built with.

**Pure Python, zero runtime dependencies.** Not a preference: it is what makes
`pip install` from a git URL instant in Colab, keeps the package able to run
under Pyodide in a browser, and lets it import where a compiled wheel could not.
"""

__all__ = ["__version__"]

__version__ = "0.1.0"
