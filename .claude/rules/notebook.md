---
paths:
  - "**/*.ipynb"
---

# Working with the notebook

## It is not a legacy artifact

`Benson Increments Calculator.ipynb` still reads `CSV_data_files/` with its own
code, unchanged since generation 2. It is not archived, and it is not wired to
the website's rules in any way.

**There is no automated check left that the notebook's reading still agrees
with the artifact's, value by value.** `tools/check_parity.mjs` used to be that
check; WP4 retired it once the website had no parser left of its own to check
against, and replaced it with `tests/conformance.json` — a fixture for the
tally, formatting and search rules that stay written twice, not for the 236
values themselves. Those stay unverified against each other by any script:
what keeps them from drifting is that the source CSVs cannot express the one
shape `parse_value` (below) cannot read — see the next section — plus a
change here now needs a person to read the diff and think about what it
changes, the same way a change to any unverified thing does.

**If you edit `parse_value`, `load_increment_data` or `get_value_dicts`,
compare its output against `dist/increments.json` by hand** —
`tools/export_reference_values.py` still runs these functions read out of the
notebook file and prints every value as JSON, even with its only caller gone:

```bash
python tools/export_reference_values.py > notebook-values.json
```

## The parser, and the trap it used to hold

The notebook's `parse_value` is a few readable lines, and that simplicity is a
feature — students read it. It splits a string cell on the range separator:

```python
if ' to ' in v:
    low, high = v.split(' to ')
    return (float(low) + float(high)) / 2
```

While that separator was a hyphen, this was a trap. pandas types a whole column
as strings as soon as one cell is a range, so in a file mixing ranges and
negatives a negative value reached that branch as a string and split on its own
minus sign:

```
'1.05-1.76'  -> 1.405
'-42'        -> ValueError: could not convert string to float: ''
```

Writing ranges as `1.05 to 1.76` is what closed it — `to` cannot be a sign, so
there is nothing left to tell apart. **That was the fix, and porting the
website's regex in here was not**: the parser has to stay short enough to read.

`tools/validate_data.py` still refuses a file holding both, and will until the
notebook stops parsing on its own. It is a hold rather than a trap now.

## Running it

It must be started from the repository root; it looks for `CSV_data_files/`
relative to where Jupyter was launched.

```bash
pip install -r requirements.txt
jupyter lab "Benson Increments Calculator.ipynb"
```

## Do not touch

`Archives/` holds two previous generations of this notebook, each frozen
alongside its own copy of the data — they read
`Archives/increment_correction_table.csv`, not the live `CSV_data_files/`. They
are a historical record. Leave them exactly as they are.
