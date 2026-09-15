# Benson Increments Calculator

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![CI](https://github.com/PrashantKumarChem/Benson-Increments-Calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/PrashantKumarChem/Benson-Increments-Calculator/actions/workflows/ci.yml)

**Use it here: <https://prashantkumarchem.github.io/Benson-Increments-Calculator/>**

Estimate the standard heat of formation of an organic molecule from Benson group
increments. Nothing to install — the calculator runs in a browser, on a laptop or
a phone.

Designed for Chemistry C450/C540 at Indiana University Bloomington by Prashant
Kumar and Dr. Nicola L. B. Pohl. Group values compiled from published Benson
group-additivity tables, including Benson (1976) and Cohen &amp; Benson (1993). Each
value is being checked against its printed source.

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
- Under the total, how far the method itself typically misses, where a
  published figure applies, with its caveats and a numbered reference at the
  foot of the page
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
2. Give it two columns: the group name, and its value in kJ/mol.
   A published range is written `1.05 to 1.76` and is averaged. The separator is
   the word, not a hyphen, because a hyphen also starts a negative number.
   Optional columns may follow - a per-row `Unit`, `Uncertainty`, `Source`,
   `Verified` and `Note`; see [.claude/rules/data.md](.claude/rules/data.md).
3. Check the file, rebuild the artifact, and move the asset version (the
   artifact's own bytes are folded into it, so a data-only change bumps it
   too):

   ```bash
   python tools/validate_data.py
   python tools/build_dist.py
   python tools/build_version.py
   ```

4. Optionally add a row to `notation/categories.csv` saying what the numbers
   are — the quantity, its symbol, the unit and a source. This is what lets the
   running total head itself `ΔHf°` rather than just `Total`. It is optional,
   and a category without a row works exactly as before.
5. Commit the CSV together with the regenerated `dist/increments.json` and
   `index.html`.

`validate_data.py` catches the mistakes that actually happen — a missing
value, a duplicate group name, a stray comma — and CI runs it on every push,
so a broken contribution cannot reach the site. `dist/increments.json` is the
artifact `benson/build.py` derives from the CSVs for every consumer — a
browser cannot list a folder the way the notebook's `glob` could, so this is
also how the site discovers which categories exist; CI regenerates it too and
fails on a diff, and so does the asset version.

## Running it locally

The site is plain HTML, CSS and JavaScript, with no build step for the browser
and no runtime dependencies. It does need to be *served* rather than opened
from disk, because browsers block pages loaded over `file://` from fetching
`dist/increments.json`, the generated data file the site reads:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

### Changing anything in `assets/`

Run `python tools/build_version.py`. The version is a short hash of the
stylesheet and the modules, and the script writes it into every slot in
`index.html` — a stylesheet link, a module `src`, and an import map that
carries the same version to every module the page loads.

It used to be a date with a letter after it, picked by hand, under the rule
that a value already in use is not a bump. That could only be checked by
reading every version the page had ever carried, and the letters ran out faster
than anyone expected; two branches once picked the same one. A hash cannot be
forgotten or picked twice. CI regenerates it and fails if the committed copy
differs, the same way it checks `dist/increments.json`.

GitHub Pages caches every file for ten minutes, and each file's ten minutes
start when that file was last fetched, so they expire at different times. A
returning visitor can therefore get a fresh `index.html` and a cached
`assets/app.js`, which is how the site once ended up stuck on "Loading
increment data": the old script looked for an element the new page no longer
had. Naming each asset with a version means a page can only ever load the files
it shipped with.

The two font files are the exception: they are named from `styles.css`, not
from `index.html`, and they are immutable — replacing a face means a new
filename, not a new version string. Do not add a `?v=` to them. They are left
out of the hash for the same reason: including them would move the version
without moving the URL that would have to change for a new face to reach
anybody.

`python tools/validate_assets.py` checks that nothing is requested unversioned,
that every module is in the import map, and that one version is used
throughout. CI runs it.

### Tests

```bash
node --test tools/*.test.mjs    # the artifact, the tally, formatting, browsing, searching
python -m unittest discover -s benson/tests -t .   # the benson package's rules
node tools/validate_css.mjs     # the stylesheet parses, and every token it names exists
```

Both of the first two also run `tests/conformance.json` — the fixture pinning
the tally arithmetic, total formatting, query matching and the method
uncertainty rule against one agreed answer, rather than against each other.
Those need nothing installed. One more does — `check_render.mjs` needs a
browser:

```bash
npm install --no-save playwright && npx playwright install chromium
node tools/check_render.mjs     # open the page and ask where its furniture ended up
```

Everything above `check_render.mjs` reads the source, which is why the faults
that have actually reached this site are the ones none of them can see: valid
CSS that parses, passes every check, and leaves the calculator somewhere nobody
can reach it. It has happened twice — a comment closed early and the browser
swallowed the media query that followed, so the running total stopped existing
on desktop; and a transition was left to chase a height that had already
changed, so the phone sheet jumped on every pick for months. A person looking
at the page caught both.

`check_render.mjs` loads the page at 320, 390 and 1180px, with and without
increments chosen, and checks that the total is on screen, that it sits beside
the increments on a wide screen, that adding one does not move the sheet, that
nothing spills sideways, and that the method's uncertainty can be read under the
total and its citation mark leads to a note the phone sheet does not cover.
Each of those has been run against a deliberately
broken copy to confirm it fails. CI installs a browser for it; nothing else
here needs one, which is why it is a separate script rather than a test.

## Layout

```
index.html              the calculator
assets/benson.js        fetching the increment artifact and handing it back (no DOM)
assets/browse.js        which increments are shown, and how they group (no DOM)
assets/format.js        how a value is written on the page (no DOM)
assets/notation.js      searching the increments, and adding up a formula (no DOM)
assets/selection.js     the chosen increments and the running total (no DOM)
assets/sheet.js         how far the phone sheet slides, and what a swipe meant (no DOM)
assets/theme.js         light, dark, and having chosen neither (no DOM)
assets/app.js           rendering and events
assets/styles.css       visual styles
assets/fonts/           IBM Plex Mono, shipped with the site (see License)
CSV_data_files/         the increment data
notation/               what the group names mean, the words students use, and
                        what each category of numbers is (categories.csv)
data/references.csv     the published works an increment's Source can name
data/uncertainty.csv    the published figure for the method's own error, and
                        what a reader needs to know about it
benson/                 the data rules, in Python - the only place one is written
dist/increments.json    the generated artifact the site fetches; benson/build.py
                        derives it from CSV_data_files/, notation/,
                        data/references.csv and data/uncertainty.csv
tools/                  data tooling and tests
Benson Increments Calculator.ipynb   the notebook - imports benson (see below)
```

The seven files without any DOM access are the ones the unit tests cover,
which is why those need no browser. What is left is the page itself, and
`tools/check_render.mjs` is what looks at that.

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
[notation/README.md](notation/README.md); nothing about the chemistry is
written into the code. `benson/notation.py` works the reading out once, at
build time, and `dist/increments.json` carries the result - so a new category
of groups is searchable once its CSV is added *and the artifact is rebuilt*
(`python tools/build_dist.py`), which `git diff --exit-code` in CI will ask
for if it is forgotten.

## The notebook

`Benson Increments Calculator.ipynb` is for people who code, and who want to
bring their own data and script against it — the website is the zero-install
way to get a number; this is the way to do more. It installs
[`benson`](benson/) — the same package `dist/increments.json` is built from —
from GitHub, and runs in Colab with nothing cloned locally:

```bash
pip install -r requirements.txt
jupyter lab "Benson Increments Calculator.ipynb"
```

works the same way locally. It carries no CSV parser of its own: the curated
data is fetched from the repository's `dist/increments.json`, and bringing
your own data means calling `benson.build.build_artifact()` on your own CSV
folder — documented in the notebook's own bring-your-own-data section — which
returns exactly the shape the curated data does, because it is the same
function.

The earlier, self-contained notebook (its own parser, no package) is archived
at
[`Archives/gen2-Benson Increments Calculator.ipynb`](<Archives/gen2-Benson Increments Calculator.ipynb>),
frozen with its own copy of the data it read.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and
[CONTRIBUTOR_GUIDELINES.md](CONTRIBUTOR_GUIDELINES.md). New increment values are
especially welcome — please include a reference for anything you add.

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
  author = {Kumar, Prashant and Pohl, Nicola L. B.},
  title  = {Benson Increments Calculator},
  year   = {2024},
  url    = {https://github.com/PrashantKumarChem/Benson-Increments-Calculator},
  version = {1.0}
}
```

For the method itself: Cohen, N.; Benson, S. W. *Chem. Rev.* **1993**, *93*, 2419.
