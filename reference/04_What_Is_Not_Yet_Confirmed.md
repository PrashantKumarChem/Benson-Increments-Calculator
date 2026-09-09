Four rows in the table above are marked *not yet*. That means the value in
the calculator is the published one and is used exactly as it stands — what
has not been checked is the description of the bonding written beside it on
this page.

They are marked rather than quietly asserted because this is a teaching tool,
and a confident wrong gloss is worse than an admitted gap. Confirming one is
a matter of editing a single line of `reference/03_Notation.csv` against
Cohen & Benson (1993) and changing *not yet* to *yes*. No code changes.

There is one open question in the data itself, not just in the description:
`notation/central_atoms.csv` records `CdN` as contributing both a carbon and
a nitrogen while `NI` contributes a nitrogen. A molecule written with both
would have its nitrogen counted twice. Nothing in the calculator is affected
today — the atom-counting feeds a molecular-formula check that is deliberately
switched off, and every enthalpy value is read straight from the CSV files.
It is recorded here so that whoever switches that check on meets it first.
