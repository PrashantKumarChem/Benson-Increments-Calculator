---
paths:
  - "**/*.ipynb"
---

# Working with the notebook

## It is the reference implementation

`Benson Increments Calculator.ipynb` is not a legacy artifact. It is the
independent implementation that `tools/check_parity.mjs` holds the website to —
every one of the 236 increments is read twice, once through the notebook's own
code and once through the site's, and any difference fails CI.

That makes it the strongest correctness guarantee in the repository. **Changing
how the notebook reads a value changes what parity means**, so run
`check_parity.mjs` after any edit here, not just the unit tests.

```bash
node tools/check_parity.mjs      # needs a PYTHON env var, interpreter with pandas
```

## The parser trap

The notebook's `parse_value` is four readable lines, and that simplicity is a
feature — students read it. It splits any string containing `-` into two halves:

```python
if '-' in v:
    parts = v.split('-')
    return (float(parts[0]) + float(parts[1])) / 2
```

pandas types a whole column as strings as soon as one cell is a range, so in a
file mixing ranges and negatives, a negative value reaches that branch as a
string and becomes `float("")`:

```
'1.05-1.76'  -> 1.405
'-42'        -> ValueError: could not convert string to float: ''
```

`tools/validate_data.py` rejects any category file containing both, which is
what keeps this unreachable. **Do not "fix" this by porting the website's regex
in** — the right fix is unambiguous notation in the data, which keeps the
notebook's parser readable. Raise it rather than deciding unilaterally.

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
