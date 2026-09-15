# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

A single Python package, `benson/`, now owns every data rule (value parsing,
notation decomposition, search-key generation, reference and uncertainty
handling) that used to be implemented twice — once for the website, once for
the notebook.

### Added
- `benson/` — a pure Python, zero-runtime-dependency package with the value,
  data, notation and build rules, and its own test suite.
- `benson/build.py` (driven by `tools/build_dist.py`) emits `dist/
  increments.json`, a generated artifact carrying every increment's value,
  precision, range bounds, notation decomposition, precomputed search
  aliases, and display/uncertainty configuration.
- `tests/conformance.json`, a fixture pinning the handful of rules that stay
  written twice (tally arithmetic, total formatting, query matching, and
  that a method's own uncertainty is never rebuilt from individual groups'),
  consumed by both the Python and JavaScript test suites.
- A widened increment schema: optional per-row `Unit`, `Uncertainty`,
  `Source`, `Verified` and `Note` columns; `data/references.csv` (the
  published works a `Source` can name) and `data/uncertainty.csv` (the
  method's own published error figure).
- A running-total uncertainty line and numbered, linked references in the
  website's UI.
- `tools/build_doi_lock.mjs`, which resolves every cited DOI against doi.org
  and fails CI on a mismatch.
- A generation-4 notebook (`Benson Increments Calculator.ipynb`) that
  imports `benson` directly, installs from GitHub, runs in Google Colab with
  nothing cloned locally, and accepts a user's own CSV data through the same
  `benson.build.build_artifact()` the curated data is built with.

### Changed
- The website (`assets/*.js`) fetches the generated artifact and renders —
  it no longer parses CSVs or implements any chemistry rule of its own.
- The mixed-range/negative validator guard in `tools/validate_data.py` is
  relaxed, now that the notebook parser it protected is retired.

### Removed
- `tools/check_parity.mjs`, the check that used to compare the website's and
  the notebook's own readings of the data — superseded by the generated
  artifact removing the drift it used to detect, plus `tests/
  conformance.json` for what's left.
- `CSV_data_files/manifest.json` and `tools/build_data.py`, which lost their
  only reader when the site switched to the artifact.
- `tools/export_reference_values.py`, the manual comparison tool that read
  the notebook's own parsing functions — retired along with the notebook
  generation it read.
- The generation-2 notebook (its own CSV parser, no shared package),
  archived to `Archives/` with a frozen copy of the data it read.

## [1.0.0] - 2024-09-12

### Added
- Initial release of Benson Increments Calculator
- Interactive Jupyter notebook for calculating heats of formation
- Support for CH, CHO, and correction increments
- Undo/redo functionality
- History panel for tracking selections
- Tabbed interface for organized increment selection
- Real-time calculation updates in kJ/mol and kcal/mol
- Comprehensive documentation and README
- CI/CD pipeline with GitHub Actions
- Contributing guidelines and code of conduct
- Issue and pull request templates
- Citation file for academic use

### Authors
- Prashant Kumar
- Nicola L. B. Pohl