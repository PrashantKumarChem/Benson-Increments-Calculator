The last column of the Notation table records what each description was checked
against. It is about the prose, not the arithmetic: every value in the
calculator is the published one and is used exactly as it stands, and what is
being checked is the sentence describing the bonding beside it.

Four entries still read *not yet*. `CO` and `O` are ordinary and almost
certainly right; they are simply unchecked. `[COd]` is a genuine open question,
already recorded in `notation/README.md`. `CdN` is the interesting one.

## The nitrogen in a C=N is counted twice

`notation/central_atoms.csv` records `CdN` as contributing a carbon **and** a
nitrogen, while `NI` contributes a nitrogen. Both appear in the same molecule,
so the nitrogen is counted twice. Methanimine, CH2=NH, has one nitrogen, and
the two groups it is made of give two:

    CdN-(H)2  +  NI-(H)   ->   C1 N2 H3

The thermochemistry points the same way. Read with `CdN` contributing only its
carbon, methanimine is 28 + 64 = 92 kJ/mol, against measurements spanning
69 ± 8 to 110 ± 8 kJ/mol. Read with `CdN` carrying the nitrogen as well — so
that no `NI` group is added — it is 28 kJ/mol, far below every measured value.

So `CdN` should almost certainly contribute `C` alone, exactly as `Cd` does.
That is one cell in `notation/central_atoms.csv`.

Nothing in the calculator is affected today. The atom counting feeds a
molecular-formula check that is deliberately switched off, and every enthalpy
comes straight from the CSV files, untouched by any of this. It is written down
here so that whoever switches that check on meets it first.
