# Contributing

Contributions are welcome, and new increment values especially so. Please
include a reference for anything you add.

By contributing you agree that your contribution is licensed under the
project's licence, GPL-3.0. Everyone taking part is asked to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## What this project is

A dependency-free web page — HTML, CSS and JavaScript with no build step, no
framework and nothing fetched from a third party — plus a Python notebook that
is the reference implementation the web version is checked against.

That means two things for a contributor. There is nothing to install to work
on the site; you only need to *serve* it. And anything you add has to keep the
promise: no CDN, no package manager, no web font, everything shipped in the
repository.

## Running it

The site must be served rather than opened from disk, because browsers block
`file://` pages from reading the CSV data:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

The notebook needs its own dependencies and must be started from the
repository folder, since it looks for `CSV_data_files/` relative to where
Jupyter was launched:

```bash
pip install -r requirements.txt
jupyter lab "Benson Increments Calculator.ipynb"
```

## Before you open a pull request

Run all of these. CI runs them too, so a pull request that skips them will go
red rather than be merged by accident.

```bash
python tools/validate_data.py       # the CSV data and the notation files
python tools/validate_assets.py     # every asset requested by version
node --test tools/*.test.mjs        # the test suite
node tools/validate_css.mjs         # the stylesheet parses, tokens declared
node tools/check_parity.mjs         # every increment, notebook vs. site
node tools/build_reference.mjs --check   # reference.html matches reference/
```

`check_parity.mjs` loads all 236 increments twice — once through the
notebook's own code, once through the site's — and fails on any difference.
Because a molecule's total is a sum of these values, agreement on every
increment means agreement on every total.

### The one thing CI cannot catch

**If you change anything in `assets/`, bump the version in `index.html`.**

Every asset is requested with a version, and the version lives in
`index.html` and nowhere else. Count the places rather than assuming a number:
it is the stylesheet link, the module `src`, and one import-map entry per
module, so it grows whenever a module is added.

`validate_assets.py` checks that those references *agree with each other*. It
cannot check that you moved them, so a missed bump passes CI and can serve a
returning visitor a stale file. That has broken the site once: an old
`app.js` looked for an element the new page no longer had and left it saying
"Loading increment data" for ever. A stale `notation.js` is worse, because it
drops the precision from each value and quietly turns −20.9 into −21.

The version is a date. A second release on the same day takes a letter
suffix — `2026-09-09b` — because a value already in use is not a bump.

`reference.html` needs no bump of its own: it is generated, and the generator
reads the version out of `index.html`. It does need rebuilding.

## Adding or changing increments

Everything the calculator shows comes from the CSV files in
`CSV_data_files/`. Adding a whole category needs no code changes.

1. Create `NN_Category_Name.csv` — two digits for the order it appears in,
   then the category name **spelled as it should be displayed**.
   `03_CHNO_Groups.csv` becomes the "CHNO Groups" section, so capitalisation
   in the filename is what you get.
2. Give it exactly two columns: the group name, and its value in kJ/mol. A
   published range is written `1.05-1.76` and is averaged; the calculator
   shows the range beside the average rather than presenting the midpoint as
   a measurement.
3. Regenerate the index and check the file:

   ```bash
   python tools/build_data.py
   python tools/validate_data.py
   ```

4. Optionally add a row to `notation/categories.csv` saying what the numbers
   are — the quantity, its symbol, the unit and a source. This is what lets
   the running total head itself `ΔHf°` rather than just `Total`. It is
   optional, and a category without a row works exactly as before.
5. Commit the CSV together with the regenerated
   `CSV_data_files/manifest.json`.

The index exists because a browser cannot list a folder the way the
notebook's `glob` could. `validate_data.py` catches the mistakes that actually
happen — a missing value, a duplicate group name, a stray comma, a stale
index.

### What the notation files are for

`notation/` holds the part of the chemistry that cannot be derived from a
group's name: what each central notation is made of, which ligands are
counted, the names students actually type, and what each category of numbers
is. It is data rather than code so that a chemist can change it without
touching a program. See [notation/README.md](notation/README.md).

## Editing the reference page

`reference.html` is **generated**. Do not edit it; edit the files in
`reference/` and rebuild:

```bash
node tools/build_reference.mjs
```

The number at the front of a filename sets the order, the rest of the
filename becomes the heading, and the extension picks the renderer — `.md` is
prose, `.csv` is a table. Adding a section means adding a file; there is no
list anywhere to keep in step.

Markdown there is a deliberate subset — headings, paragraphs, `-` bullets,
`[text](url)`, `` `code` ``, `**bold**`, `*italic*` — because the whole
language would mean a dependency. Anything else is shown as the characters it
is made of. A line reading `{{csv: some/file.csv}}` includes that CSV as a
table, which is how the category table on the page is the same
`notation/categories.csv` the calculator itself reads rather than a second
copy that could disagree.

Text in backticks is set in the monospace face, which is why the notation
column of `reference/05_Notation.csv` is written `` `Cd` ``: the content
decides its own typography, so the renderer never has to know which column
holds notation.

CI rebuilds the page and fails if the result differs from what was committed,
so a hand-edit of `reference.html` is reported rather than merely lost.

## Style

- Match the surrounding code. There is no linter for the JavaScript; there is
  a stylesheet checker, and there are tests.
- Comments should say *why*, not *what*. The existing comments are long
  because the reasons are the part that is expensive to reconstruct.
- The seven files without any DOM access hold everything worth testing, which
  is why the test suite needs no browser. Keep new logic testable that way if
  you can.
- Nothing has a corner radius, notation and numerals are set in the mono face
  and prose is not, and no rule uses `text-transform: uppercase` on a
  chemistry symbol — uppercasing renders ΔHf° as ΔHF°.

## Reporting a problem

Use the [issue tracker](https://github.com/PrashantKumarChem/Benson-Increments-Calculator/issues).
For a wrong number, please say which group, what value you expected, and the
source you expected it from — that is the report that can be acted on
immediately.
