"""Finding the source data and reading it into records.

Will own what `tools/benson_data.py` owns today besides value parsing:

- what counts as a category file, and the ordering its filename declares
- reading a two-column CSV into rows, splitting on the last comma so a group
  name may hold one and a value may not
- the category metadata that says what a category's numbers are, and the
  references a row cites
- a user's own file, read by exactly these rules rather than by a second parser

Reading does not judge: validation is a separate question, asked once the rows
are in hand.
"""
