The `Verified` column in the Notation table records whether a chemist has
checked that description against Cohen & Benson (1993). **No row has had that
check yet**, so every row reads *not yet*.

The column is about the prose, not the arithmetic. Every value in the
calculator is the published one and is used exactly as it stands; what is
unconfirmed is the sentence describing the bonding beside it. Four entries are
worth more attention than the rest — `NI`, `CdN`, `NC` and `ONO` — because
they are the ones where the notation admits more than one reading.

They are marked rather than quietly asserted because this is a teaching tool,
and a confident wrong gloss is worse than an admitted gap. Confirming one is a
matter of editing a single line of `reference/03_Notation.csv` and changing
*not yet* to *yes*. There is no code to change.

## An open question in the data itself

`notation/central_atoms.csv` records `CdN` as contributing both a carbon and a
nitrogen, while `NI` contributes a nitrogen. A molecule written with both would
have its nitrogen counted twice.

Nothing in the calculator is affected today: the atom counting feeds a
molecular-formula check that is deliberately switched off, and every enthalpy
value is read straight from the CSV files. It is recorded here so that whoever
switches that check on meets it first.
