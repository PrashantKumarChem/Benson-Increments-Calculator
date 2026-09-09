# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-09

The calculator is now a web page. Version 1.0.0 was a Jupyter notebook; that
notebook is still here and is still the reference the web version is checked
against, but it is no longer how most people will use this.

### Added
- A dependency-free web version: HTML, CSS and JavaScript, no build step, no
  framework, nothing fetched from a third party. It runs on a laptop or a
  phone with nothing to install.
- Search by the shorthand a student writes. `CH3` finds `C-(C)(H)3` by reading
  the notation, which a plain text search cannot do.
- A table view showing each value beside its unit, quantity and source.
- A running total in kJ/mol and kcal/mol, headed by what it is a total *of*,
  and told plainly when it mixes two different physical quantities.
- Published ranges are shown beside the averaged value rather than presented
  as measurements, and the total reports how far it could move.
- A reference page (`reference.html`) covering the method, the notation, a
  glossary, worked examples and the sources. It is generated from files in
  `reference/` that a chemist can edit without touching code.
- `notation/`, holding the part of the chemistry that cannot be derived from a
  group's name, as data rather than code.
- A test suite that needs no browser, a parity check that compares every
  increment against the notebook, and validators for the data, the assets and
  the stylesheet. CI runs all of them.
- Dark mode, a keyboard path through the increments, and the ability to copy
  the working out as text.
- `CODE_OF_CONDUCT.md`, and `AI_USE.md` recording where generative AI was used.
- IBM Plex Mono shipped with the site under the SIL Open Font License, so the
  notation lines up the same way everywhere and nothing is fetched from a CDN.

### Changed
- Every asset is requested with a version, so a returning visitor cannot be
  served a stale module alongside a current page.
- `CONTRIBUTING.md` rewritten: it described a Python-only notebook project and
  told contributors to follow PEP 8 and test in Jupyter, neither of which is
  now the way to work on this. `CONTRIBUTOR_GUIDELINES.md` is folded into it.
- Values are shown at the precision their source claims, so `-42` is no longer
  rendered `-42.00`.

### Note on the 1.0.0 entry below
That entry describes the Jupyter notebook, which is unchanged and still ships
here: it still uses `ipywidgets.Tab` for its tabbed interface and still has a
history panel. The web version released here is a separate front end over the
same data and has neither; it shows every category at once and filters instead.

One item in that entry was not accurate. It lists a code of conduct, which was
not added to the repository until this release.

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