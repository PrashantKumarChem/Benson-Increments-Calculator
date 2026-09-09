# Benson Increments Calculator

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![CI](https://github.com/PrashantKumarChem/Benson-Increments-Calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/PrashantKumarChem/Benson-Increments-Calculator/actions/workflows/ci.yml)

**Use it here: <https://prashantkumarchem.github.io/Benson-Increments-Calculator/>**

Estimate the standard heat of formation of an organic molecule from Benson group
increments. Nothing to install — the calculator runs in a browser, on a laptop or
a phone.

Designed for Chemistry C450/C540 at Indiana University Bloomington by Prashant
Kumar and Dr. Nicola L. B. Pohl. Values follow Cohen &amp; Benson, *Chem. Rev.*
**1993**, *93*, 2419.

## What it does

The method is deliberately left in the student's hands: the calculator does not
inspect a structure or decide which groups a molecule needs. It presents every
published increment as a button, and you choose the ones your molecule requires,
so the reasoning stays visible and the arithmetic stays honest.

- Search by the shorthand you write - `CH3` finds `C-(C)(H)3`, `methylene`
  finds `C-(C)2(H)2` - or scroll the whole library, grouped by category
- Narrow to one category or several at once; choosing a molecule's groups
  usually crosses two or three of them
- Click a group to add it; adjust the count rather than clicking eight times
- Switch to the table to see each value beside its unit, quantity and source
- Running total in kJ/mol and kcal/mol, always on screen, headed by what it is
  a total *of* — and told plainly when it mixes two different quantities
- Remove any single entry, undo the last addition, or reset
- Copy the whole working out as text, for pasting into a report

### Keyboard

| | |
|---|---|
| `Ctrl`/`Cmd` + `K` | jump to the search box |
| arrow keys | move through the increments |
| `Enter` | add the one in focus |
| `+` / `-` | adjust its count |

## Adding or changing increments

Everything the calculator shows comes from the CSV files in `CSV_data_files/`.
Adding a category needs no code changes:

1. Create `NN_Category_Name.csv` — two digits for the order it appears in, then
   the category name **spelled as it should be displayed**. `03_CHNO_Groups.csv`
   becomes the "CHNO Groups" section, so capitalisation in the filename is what
   you get.
2. Give it exactly two columns: the group name, and its value in kJ/mol.
   A published range is written `1.05-1.76` and is averaged.
3. Regenerate the category index and check the file:

   ```bash
   python tools/build_data.py
   python tools/validate_data.py
   ```

4. Optionally add a row to `notation/categories.csv` saying what the numbers
   are — the quantity, its symbol, the unit and a source. This is what lets the
   running total head itself `ΔHf°` rather than just `Total`. It is optional,
   and a category without a row works exactly as before.
5. Commit the CSV together with the regenerated `CSV_data_files/manifest.json`.

The index exists because a browser cannot list a folder the way the notebook's
`glob` could. `validate_data.py` catches the mistakes that actually happen —
a missing value, a duplicate group name, a stray comma, a stale index — and CI
runs it on every push, so a broken contribution cannot reach the site.

## The reference page

`reference.html` explains the method, the notation and where the values come
from. It is **generated** — what you edit is the files in `reference/`:

```
reference/01_The_Method.md            prose, in Markdown
reference/03_Notation.csv             a table, in CSV
reference/05_Glossary.csv             a table, in CSV
```

The number sets the order, the rest of the filename becomes the heading, and
the extension picks the renderer — `.md` is prose, `.csv` is a table. Adding a
section is adding a file; there is no list anywhere to keep in step. Then:

```bash
node tools/build_reference.mjs        # rewrite reference.html
node tools/build_reference.mjs --check  # what CI runs
```

Markdown here is a deliberate subset — headings, paragraphs, `-` bullets,
`[text](url)`, `` `code` ``, `**bold**`, `*italic*` — because the whole
language would mean a dependency and this site has none. Anything else is
shown as the characters it is made of. A line reading `{{csv: some/file.csv}}`
includes that CSV as a table, which is how the category table on the page is
the same `notation/categories.csv` the calculator itself reads rather than a
second copy that could disagree.

Two things worth knowing. Text in `` ` `` comes out in IBM Plex Mono, which is
why the notation column of `reference/03_Notation.csv` is written `` `Cd` `` —
the content decides its own typography, so the renderer never has to know
which column holds notation. And a CSV cell containing a comma should be
quoted, which is what a spreadsheet does on its own; these files are meant to
survive a round trip through Excel.

Do not edit `reference.html` by hand. It is regenerated from `reference/`, so
an edit there is lost on the next build — and CI compares the two, so it is
reported rather than merely lost.

## Running it locally

The site is plain HTML, CSS and JavaScript with no build step or dependencies.
It does need to be *served* rather than opened from disk, because browsers block
pages loaded over `file://` from reading the CSV files:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

### Changing anything in `assets/`

Bump the version in `index.html`. It appears in one place — a stylesheet link, a
module `src`, and an import map that carries the same version to every module
the page loads.

GitHub Pages caches every file for ten minutes, and each file's ten minutes
start when that file was last fetched, so they expire at different times. A
returning visitor can therefore get a fresh `index.html` and a cached
`assets/app.js`, which is how the site once ended up stuck on "Loading
increment data": the old script looked for an element the new page no longer
had. Naming each asset with a version means a page can only ever load the files
it shipped with.

The two font files are the exception: they are named from `styles.css`, not
from `index.html`, and they are immutable — replacing a face means a new
filename, not a new version string. Do not add a `?v=` to them, or there
would be a ninth place to keep in step that nothing checks.

`python tools/validate_assets.py` checks that nothing is requested unversioned,
that every module is in some page's import map, and that one version is used
throughout. CI runs it.

It reads every page, not just `index.html`. `reference.html` links the same
stylesheet, and a checker that only opened `index.html` would have called that
page fine while it shipped a version nobody had bumped. `reference.html` does
not carry a version of its own: `tools/build_reference.mjs` reads the one in
`index.html` and stamps it, so the two cannot drift, and the check above is
what catches the remaining case of someone editing the generated file by hand.

### Tests

```bash
node --test tools/*.test.mjs    # value parsing, the tally, formatting, browsing, notation, the reference renderer
node tools/check_parity.mjs     # every increment, notebook vs. site
```

`check_parity.mjs` loads all 236 increments twice — once through the notebook's
own code, once through the site's — and fails on any difference. Because a
molecule's total is a sum of these values, agreement on every increment means
agreement on every total.

## Layout

```
index.html              the calculator
reference.html          the reference page (generated - edit reference/)
assets/benson.js        reading and parsing the CSV data (no DOM)
assets/browse.js        which increments are shown, and how they group (no DOM)
assets/format.js        how a value is written on the page (no DOM)
assets/notation.js      reading Benson notation: what a group name is made of (no DOM)
assets/selection.js     the chosen increments and the running total (no DOM)
assets/sheet.js         how far the phone sheet slides, and what a swipe meant (no DOM)
assets/theme.js         light, dark, and having chosen neither (no DOM)
assets/app.js           rendering and events
assets/styles.css       visual styles
assets/fonts/           IBM Plex Mono, shipped with the site (see License)
CSV_data_files/         the increment data, plus the generated manifest
notation/               what the group names mean, the words students use, and
                        what each category of numbers is (categories.csv)
reference/              what the reference page says: prose in .md, tables in
                        .csv, one file per section
tools/                  data tooling and tests
Benson Increments Calculator.ipynb   the original notebook (see below)
```

The seven files without any DOM access are the ones the test suite covers,
which is why it needs no browser.

They used to be five, and the README used to claim they held everything worth
testing. That stopped being true as app.js grew: how far the sheet slides, what
a swipe meant, and which theme is in force are all decisions rather than
wiring, and all three were reachable only by opening the page. They are in
sheet.js and theme.js now, and tested. What is left in app.js is genuinely
wiring - building HTML, attaching listeners, reading elements - with one
exception still to move: the keyboard grid navigation works out how many cards
share a row, which is arithmetic wearing a DOM coat.

Two things the tests cover that are not modules at all. tools/validate_css.mjs
checks that the stylesheet parses and that every token it names exists, because
CSS fails quietly and a stray comment-close once removed a whole media query
without anything going red. tools/theme.test.mjs checks that the inline script
in index.html still agrees with theme.js about the storage key and its two
values - that script runs before the first paint, so it cannot import, and the
duplication is forced.

## Searching by shorthand

`CH3` does not appear anywhere in `C-(C)(H)3`, so a plain text search cannot
find a methyl group — which is the notation a student is most likely to type.
The calculator instead reads the notation: a name gives its central atom and its
ligands, so a carbon with three hydrogen ligands is findable as `CH3`, and
`Cd-(H)2` answers to both `CdH2` and `CH2`.

Ties are settled by the order the CSV files are written in. Seven groups match
`CH3` exactly; the files run simplest first, so the plain methyl comes out on
top without any code holding an opinion about which methyl matters most.

Names that cannot be worked out from the notation — that `C-(C)(H)3` is called a
methyl, that `CO-(C)2` is a ketone — live in `notation/synonyms.csv`, alongside
small tables saying what the notation is made of. See
[notation/README.md](notation/README.md); nothing about the chemistry is written
into the code, so a new category of groups is searchable the moment its CSV is
added.

## The notebook

`Benson Increments Calculator.ipynb` is the original Jupyter version and remains
the reference the web version is checked against. Run it with:

```bash
pip install -r requirements.txt
jupyter lab "Benson Increments Calculator.ipynb"
```

It must be started from the repository folder, since it looks for
`CSV_data_files/` relative to where Jupyter was launched.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), which covers running the project, the
checks to run before opening a pull request, how to add a category of
increments, and how to edit the reference page. Everyone taking part is asked
to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

New increment values are especially welcome — please include a reference for
anything you add.

[AI_USE.md](AI_USE.md) records where generative AI was used in building this.

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

The one thing here that is not ours is the typeface. IBM Plex Mono is
Copyright © 2017 IBM Corp., used under the SIL Open Font License 1.1 — the
full text ships beside it in [assets/fonts/OFL.txt](assets/fonts/OFL.txt). The
OFL is a free/libre licence and the font files are served from this repository
rather than a CDN, so everything this site sends a reader is open source and
nothing is fetched from a third party.

## Citation

```bibtex
@software{benson_increments_calculator,
  author  = {Kumar, Prashant and Pohl, Nicola L. B.},
  title   = {Benson Increments Calculator},
  year    = {2026},
  url     = {https://github.com/PrashantKumarChem/Benson-Increments-Calculator},
  version = {2.0.0}
}
```

`CITATION.cff` carries the same details in machine-readable form.

For the method itself: Cohen, N.; Benson, S. W. Estimation of Heats of
Formation of Organic Compounds by Additivity Methods. *Chem. Rev.* **1993**,
*93* (7), 2419–2438. DOI:
[10.1021/cr00023a005](https://doi.org/10.1021/cr00023a005).
