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
