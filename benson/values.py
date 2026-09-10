"""Reading a written value: what the number is, and how the source wrote it.

Will own what `parse_value` in `tools/benson_data.py` and `readValue` in
`assets/benson.js` each own today, once:

- a cell as a number in the unit its category declares
- a published range, averaged, keeping both bounds so the page can show them
- the precision the source claims, so `-42` is not rendered as `-42.00`
- rejecting anything that is neither, loudly, naming the row

The written forms themselves are the rule this file exists to state exactly:
`-42`, `13.8`, and a range as `1.05 to 1.76`. A bare hyphen is not a range
separator, because it also starts a negative number.
"""
