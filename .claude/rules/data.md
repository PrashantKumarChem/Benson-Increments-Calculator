---
paths:
  - "CSV_data_files/**"
  - "notation/**"
---

# Working with the increment data

These files are the point of the project. A wrong number here reaches a student
as a fact.

## Provenance

- **Every value needs a source.** A number without a citation cannot be checked
  by anyone, and an uncited value in a teaching tool is worse than a missing one.
- **Do not "fix" a chemistry value because it looks wrong.** Raise it, with the
  reasoning and the source. Some entries are deliberate and documented — the
  four `[COd]` ketene rows, for instance, are a chemist's call that was
  explicitly left alone — and changing one silently can make several documents
  false at once.
- Values currently follow Cohen & Benson, *Chem. Rev.* **1993**, *93*, 2419.
  Later revisions exist but cover fewer elements; the choice is deliberate.

## File format

Each category file is `NN_Category_Name.csv` — two digits for display order,
then the category name **spelled as it should appear on the page**. The
capitalisation in the filename is what users see, which is why no list of
chemical acronyms lives in the code.

Exactly two columns: the group name, then its value in kJ/mol. A published range
is written `1.05-1.76` and is averaged.

**The files have no trailing newline.** Appending a row with `>>` corrupts the
last existing row. It fails loudly rather than silently, but it wastes a cycle.

## Two rules the validator enforces, and why

- **A group name must be unique across every file, not just within one.**
  Anything that annotates a group from outside these files — a source, an
  uncertainty, a synonym — can only key on the name.
- **No file may contain both a published range and a negative value.** The
  notebook is the reference implementation `check_parity.mjs` holds this data to,
  and its parser cannot read that combination: pandas types a whole column as
  strings as soon as one cell is a range, and the notebook then splits every cell
  on `-`, so a negative value becomes `float("")` and raises. Put them in
  separate category files.

## After changing anything here

```bash
python tools/build_data.py        # regenerates manifest.json
python tools/validate_data.py
node   tools/check_parity.mjs     # the site and the notebook must still agree
```

`manifest.json` is generated. Never hand-edit it — a browser cannot list a
directory, so the site reads that file instead of scanning the folder, and CI
regenerates it and fails on a diff.

## Do not touch

`Archives/` holds previous generations of the tool, each frozen with its own
copy of the data. They are a historical record, not live files.
