---
paths:
  - "**/*.ipynb"
---

# Working with the notebook

## It imports `benson`; it has no parser of its own

`Benson Increments Calculator.ipynb` is generation 4. It does not read
`CSV_data_files/` or `notation/` with code of its own — it installs the
`benson` package (`%pip install git+https://github.com/…`, D6) and either
fetches the built artifact (`dist/increments.json`) over HTTPS for the
curated data, or calls `benson.build.build_artifact()` directly on a user's
own CSV folder for bring-your-own-data. Both paths return the same shape,
because both are the same function. There is no second reading of the data
in this file to drift from the artifact's, so **the guard that used to hold
that in check is gone** — see the next section.

If you are editing this notebook and find yourself parsing a CSV, converting
a value, or decomposing a group name by hand: stop. That rule belongs in
`benson/`, which this notebook consumes and does not change (see
`AGENTS.md`'s territory notes, or ask). The one thing this notebook is
allowed to carry a second copy of is the small residue that is not a
generated-artifact field and not a `benson` function either — the running
total's arithmetic, how it is formatted, and that the method's own
uncertainty is never rebuilt from the chosen groups' own. The website carries
the same handful of rules in `assets/format.js`; this notebook's copy is
checked against `tests/conformance.json`, the same fixture the website's
tests and `benson`'s own Python tests are held to — the notebook runs that
check itself, in a cell, every time it runs.

## The mixed-range/negative guard is retired (H3)

`tools/validate_data.py` used to refuse a category file holding both a
published range and a negative value, because generation 2's own
`pandas`-based `parse_value` mis-split such a file (a range typed its whole
column as strings, so a negative value shared the type and split on its own
sign — `'-42'` became `float('')`). That parser is archived along with the
notebook that ran it (see below); nothing live reads this data any way but
`benson.values.read_value` does, so there is no second reading left for the
guard to protect against disagreeing. The rule was retired for that reason
alone, not because the combination is now safe to misread — it never was, and
`read_value` always read it correctly once WP1 wrote ranges as `1.05 to 1.76`
rather than a bare hyphen.

## Running it

Works the same locally and in Colab — it fetches its data over HTTPS either
way, so there is no `CSV_data_files/` to be relative to:

```bash
pip install -r requirements.txt
jupyter lab "Benson Increments Calculator.ipynb"
```

If you are developing `benson` itself and want the notebook to see local
changes rather than what is on GitHub, skip the install cell and make sure an
editable install (`pip install -e .`, run from the repository root) is on the
kernel's path before the import cell runs.

## Do not touch

`Archives/` holds three previous notebooks, each frozen alongside its own
copy of the data — they never read the live `CSV_data_files/`:

| File | Reads |
|---|---|
| `Archives/2_1-BIC.ipynb`, `Archives/Benson Increments Calculator.ipynb` (generation 1) | `Archives/increment_correction_table.csv` |
| `Archives/gen2-Benson Increments Calculator.ipynb` (generation 2, archived at WP7, 2026-09-15) | `Archives/CSV_data_files_gen2/`, a snapshot of `CSV_data_files/` as it stood the day it was archived |

They are a historical record, each naming its own generation in a leading
markdown cell. Leave them exactly as they are — including the code inside
them, which is deliberately not migrated to `benson` or updated in any way.
