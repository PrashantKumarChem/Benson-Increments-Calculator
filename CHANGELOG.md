# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

A single Python package, `benson/`, now owns every data rule (value parsing,
notation decomposition, search-key generation, reference and uncertainty
handling) that used to be duplicated in the website's own JavaScript. The
website now fetches a generated artifact and implements no chemistry rule of
its own. The notebook does not yet import `benson` — it still has its own
separate implementation, pending a rewrite on a not-yet-merged pull request
(see the note under "Removed" below).

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

### Changed
- The website (`assets/*.js`) fetches the generated artifact and renders —
  it no longer parses CSVs or implements any chemistry rule of its own.

### Removed
- `tools/check_parity.mjs`, the check that used to compare the website's and
  the notebook's own readings of the data — superseded by the generated
  artifact removing the drift it used to detect, plus `tests/
  conformance.json` for what's left.
- `CSV_data_files/manifest.json` and `tools/build_data.py`, which lost their
  only reader when the site switched to the artifact.

<!--
  The notebook rewrite (a new generation-4 notebook, the H3 validator-guard
  relax, and the retirement of tools/export_reference_values.py and the
  generation-2 notebook) is on a separate, not-yet-merged pull request
  (#37) as of this entry. Add those to this section once it actually lands
  here - not before, the same mistake this file exists to stop making.
-->

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