---
paths:
  - "CSV_data_files/**"
  - "notation/**"
  - "data/**"
---

# Working with the increment data

These files are the point of the project. A wrong number here reaches a student
as a fact.

## Provenance

- **Every value needs a source.** A number without a citation cannot be checked
  by anyone, and an uncited value in a teaching tool is worse than a missing one.
  A row names its source by a `Source` key into `data/references.csv`. How the
  citation behind that key is written and verified is
  [`citations.md`](citations.md)'s rule; this one is about the files.
- **Do not "fix" a chemistry value because it looks wrong.** Raise it, with the
  reasoning and the source. Some entries are deliberate and documented — the
  four `[COd]` ketene rows, for instance, are a chemist's call that was
  explicitly left alone — and changing one silently can make several documents
  false at once.
- Group values compiled from published Benson group-additivity tables, including
  Benson (1976) and Cohen & Benson (1993). Each value is being checked against its
  printed source. Which table a given row came from is not yet recorded, so do not
  credit a row or a category to one paper. Later revisions exist but cover fewer
  elements.
- **Leave `Source` and `Verified` blank until someone has the printed source in
  hand.** A blank is honest. A filled-in guess reads exactly like a check that
  happened, and nothing downstream can tell the two apart.

## File format

Each category file is `NN_Category_Name.csv` — two digits for display order,
then the category name **spelled as it should appear on the page**. The
capitalisation in the filename is what users see, which is why no list of
chemical acronyms lives in the code.

The first two columns are required: the group name, then its value. They are
found by position, so their titles are free text. A published range is written
`1.05 to 1.76` and is averaged. **The separator is the word `to`, not a hyphen**
— a hyphen also starts a negative number, and a form that has to work out which
one it is in front of is a form two implementations can work out differently. A
row still written `1.05-1.76` is refused by name.

Any further column is optional, found by its exact title, and may be blank or
left out altogether. A row may stop before its trailing optional cells.

| Column | What it holds |
|---|---|
| `Unit` | `kJ/mol` or `kcal/mol`, overriding for this row the unit `notation/categories.csv` declares for its category. A value is stored as its source prints it; the build converts once. |
| `Uncertainty` | The ± the source prints for this group, in the row's unit: one unsigned number. |
| `Source` | A `Key` in `data/references.csv` — never a citation. |
| `Verified` | Who checked the value against its printed source, and where: `date;initials;page`. |
| `Note` | Free text. |

A column with any other title is refused, so a misspelt `Sources` cannot drop
what it holds without a word.

**Widening a file is safe now.** It used to break the gen-2 notebook, whose
`get_value_dicts` skipped any file without exactly two columns — the category
disappeared from it with only a warning, and no check here noticed. WP7 archived
that notebook with a frozen copy of its data (`Archives/`), so the live files
have no second reader left to lose a category.

**The files have no trailing newline.** Appending a row with `>>` corrupts the
last existing row. It fails loudly rather than silently, but it wastes a cycle.

## `data/references.csv`

One row per published work. A row's `Source` names a `Key`, so a citation is
written once, here, however many rows cite it. Nobody writes a reference number
down: a reference's number is its place in this file, assigned when the
artifact is built, so inserting one renumbers the rest. The page lists them in
that order at its foot.

| Column | What it holds |
|---|---|
| `Key` | The short name a `Source` uses. Required. |
| `Citation` | The full citation, as the page prints it. Required. |
| `DOI` | The work's DOI, or blank. |
| `Type` | What kind of work it is, as the DOI lock compares it: `journal-article`, for instance. |
| `Title` | The title, exactly as it stands inside the citation's quotes. |
| `Authors` | Family names, separated by `;`, since a name can hold a comma. |
| `Year` | Four digits. |
| `Volume`, `FirstPage` | As the citation ends: `…, year, volume, first page`. |
| `Publisher` | For a work compared on its publisher, such as a dataset. |

The columns from `Type` on say which work the citation is, and a reference with
no DOI can leave them blank. A DOI is opaque - a near miss resolves to a real,
different paper - so a reference with one has to pass the DOI lock
(`node tools/build_doi_lock.mjs`, then `node --test tools/doi_lock.test.mjs`).
The lock compares the DOI's record with these fields and checks that each was
read off the citation beside it; which fields a type is compared on is
`tools/doi_lock.mjs`'s to say.

## `data/uncertainty.csv`

The method's own error on a whole total, as a published figure: one row per
quantity it is published for. The line under the running total is written
from it, and its `Note` is printed at the foot of the page. It is not any
group's uncertainty, and nothing adds those up into it - the group values were
fitted to whole molecules together, so their errors are not independent, and a
sum of them overstates the whole.

| Column | What it holds |
|---|---|
| `Symbol` | The quantity symbol of the totals it describes, as `notation/categories.csv` writes it. |
| `Value` | The figure as its source prints it: one unsigned number. |
| `Unit` | The unit it is printed in. Blank is kJ/mol. |
| `Phase` | The phase it was measured in, which the line names. |
| `Elements` | The element symbols of the compounds it was measured on, separated by spaces. A total holding another element is told the figure does not cover it. |
| `Source` | A `Key` in `data/references.csv`. |
| `Note` | What a reader needs in order to read the figure honestly: what kind of statistic it is, whose values it was measured with, where it is weakest. |

Every column but `Unit` has to be filled in. A figure with no source is
uncited, one with no note has lost its caveats, and the line names the phase,
the quantity and the elements. Which figure is shown, and what is said beside
it, are chemistry and wording decisions: raise a change, with the page it comes
from, rather than making one.

## Rules the validator enforces, and why

- **A group name must be unique across every file, not just within one.**
  Anything that annotates a group from outside these files — a source, an
  uncertainty, a synonym — can only key on the name.
- **Every `Source` must be a key in `data/references.csv`.** A key naming
  nothing claims a citation nobody can find, and the build refuses one as well.
  A blank `Source` is not a fault.
- **A reference's work fields must be readable.** No work field without a
  `Type` to say what it describes, and a `Year` of four digits. Otherwise the
  build would drop them, and the lock would refuse the DOI for a reason that
  names something else.
- **A figure in `data/uncertainty.csv` must be complete, and describe a total
  that exists.** Every column but `Unit` filled in; a `Symbol` that a category
  declares, and only once; one unsigned number; element symbols; a `Source`
  that is a key. The build refuses the same faults, asking the same function.

## A rule that used to be here is gone

Nothing now refuses a file holding both a published range and a negative value.
That guard existed for generation 2's own parser, and WP7 archived that notebook
with a frozen copy of its data, so there is no second reading left to protect.

[`notebook.md`](notebook.md) records why it went, and says the part that matters
when you add a row: it was retired because nothing misreads the combination any
more, **not** because the combination was ever safe to misread. `read_value` is
the one reader left, and `tools/validate_data.py` keeps the reasoning where the
rule stood.

## After changing anything here

```bash
python tools/validate_data.py
python tools/build_dist.py        # regenerates dist/increments.json, the built artifact
python tools/build_version.py     # moves the asset version - the artifact's bytes are folded in
```

The site no longer runs a second reading of the data to check against (WP3 moved it onto the artifact; WP4 retired `check_parity.mjs`, the check that used to compare them), and since WP7 the gen-2 notebook reads a frozen copy in `Archives/` rather than these files. `benson/` is the only thing that reads them now, which is what let the range/negative guard retire: there is no second reading left to drive apart.

`dist/increments.json` is generated. Never hand-edit it — a browser cannot
list a directory, so `benson/build.py` derives the artifact from these files
once, at build time, and that is what the site fetches instead of scanning the
folder. CI regenerates it and fails on a diff.

## Do not touch

`Archives/` holds previous generations of the tool, each frozen with its own
copy of the data. They are a historical record, not live files.
