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
- Running total in kJ/mol and kcal/mol, always on screen
- Remove any single entry, undo the last addition, or reset

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

## Running it locally

The site is plain HTML, CSS and JavaScript with no build step or dependencies.
It does need to be *served* rather than opened from disk, because browsers block
pages loaded over `file://` from reading the CSV files:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

### Tests

```bash
node --test tools/*.test.mjs    # value parsing, the tally, formatting, browsing, notation
node tools/check_parity.mjs     # every increment, notebook vs. site
```

`check_parity.mjs` loads all 236 increments twice — once through the notebook's
own code, once through the site's — and fails on any difference. Because a
molecule's total is a sum of these values, agreement on every increment means
agreement on every total.

## Layout

```
index.html              the calculator
assets/benson.js        reading and parsing the CSV data (no DOM)
assets/browse.js        which increments are shown, and how they group (no DOM)
assets/format.js        how a value is written on the page (no DOM)
assets/notation.js      reading Benson notation: what a group name is made of (no DOM)
assets/selection.js     the chosen increments and the running total (no DOM)
assets/app.js           rendering and events
assets/styles.css       visual styles
CSV_data_files/         the increment data, plus the generated manifest
notation/               what the group names mean, the words students use, and
                        what each category of numbers is (categories.csv)
tools/                  data tooling and tests
Benson Increments Calculator.ipynb   the original notebook (see below)
```

The five files without any DOM access hold everything worth testing, which is
why the test suite needs no browser.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) and
[CONTRIBUTOR_GUIDELINES.md](CONTRIBUTOR_GUIDELINES.md). New increment values are
especially welcome — please include a reference for anything you add.

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

## Citation

```bibtex
@software{benson_increments_calculator,
  author = {Kumar, Prashant and Pohl, Nicola L. B.},
  title  = {Benson Increments Calculator},
  year   = {2024},
  url    = {https://github.com/PrashantKumarChem/Benson-Increments-Calculator},
  version = {1.0}
}
```

For the method itself: Cohen, N.; Benson, S. W. *Chem. Rev.* **1993**, *93*, 2419.
