"""The Benson group-additivity data rules, written once.

The calculator exists twice — a static website and a Jupyter notebook — running
in two engines that cannot share code. Today each has its own implementation of
the same rules and `tools/check_parity.mjs` checks the two agree on the data
that happens to exist. This package is the replacement: the rules live here, in
Python, and everything else consumes them. The website reads a generated
artifact and stops parsing; the notebook imports this package directly, which is
also what lets a student load their own file under identical rules.

Nothing has moved in yet. Each module below states what it will own so that the
extraction lands in one place per rule rather than wherever it fits.

**Pure Python, zero runtime dependencies.** Not a preference: it is what makes
`pip install` from a git URL instant in Colab, keeps the package able to run
under Pyodide in a browser, and lets it import where a compiled wheel could not.
"""

__all__ = ["__version__"]

#: Pre-release: the package is a skeleton and exports no rules yet.
__version__ = "0.1.0"
