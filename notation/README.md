# What the notation files are for

Benson notation already says what a group is made of: `C-(C)2(H)2` is a carbon
carrying two carbons and two hydrogens. The calculator reads that so a student
can search for a group by the shorthand they write — `CH3` finds `C-(C)(H)3`,
which is not something a plain text search can do, since those four characters
appear nowhere in the printed name.

Most of the reading is derived from the notation itself, which is why a new
category of groups is understood without anyone editing code. These three files
hold the part that cannot be derived, so the chemistry stays in data where a
chemist can change it.

Each file is a two-column CSV, same as the increment files.

## A formula check, deliberately not switched on

The same reading adds up to a molecular formula — the groups chosen for decane
come to C10H22, and for ethanol C2H6O. `summarise()` in `assets/notation.js`
does this and is covered by `tools/notation.test.mjs`, but nothing in the page
shows it.

The reason is that a formula is only true of the molecule once *every* group of
that molecule has been chosen, and a half-finished one reads as wrong rather
than as unfinished. Choose `C-(H)2(C)(N)` and no nitrogen appears, because the
`(N)` is a ligand: that nitrogen is counted by its own `N-(…)` group, which the
student has not added yet. The accounting is right and the display is
misleading, which is the wrong way round for a teaching tool.

The parsing stays because searching needs it anyway, and because the tables
below took some working out. Switching the check on later is a matter of
rendering what `summarise()` already returns.

## central_atoms.csv

What each central notation is made of. `CO` is a carbon and an oxygen; `Cd`,
`Ct` and `CB` are all just a carbon in different bonding environments.

Write a composition as element symbols separated by spaces, with a count where
there is more than one: `C`, `C O`, `N O2`.

A group whose central notation is missing from this file is reported rather
than skipped: tools/notation.test.mjs fails until it is listed, so a formula can
never come out quietly short of an atom. Adding an element to the data therefore
means adding a row here.

## ligand_atoms.csv

Which ligands are counted where they are written, in the same composition
notation.

Almost none are. `C-(C)3(H)` is a carbon bonded to three other carbons, and each
of those carbons is counted by its own group — counting them here as well would
give every carbon one extra for each neighbour it happens to have.

Hydrogen is the exception, and today the only one: it never has a group of its
own, so a group is the only place its atoms are ever counted. That is a rule of
the method rather than of any particular table, but it is still a statement
about chemistry, so it belongs here rather than inside the code.

## special_labels.csv

Rows whose name does not follow the usual `Central-(ligand)` shape, and so have
to say outright what they contribute. Three kinds of answer:

- a composition, written as above
- `none` — an energy term that contributes no atoms at all
- `unknown` — it does contribute atoms, but we are not yet certain how many, so
  anything counting them declines to give an answer rather than guess

A name listed here always wins over what the notation would suggest, which is
how a row that merely *looks* like a group is kept from adding phantom atoms.

Corrections and cyclohexane A-values need no entry: they are not written in
Benson notation, so they are already understood to be energy terms.

### The open question: the four `[COd]` ketene rows

`[COd]-Cd(H)2` and its three relatives are marked `unknown`, so choosing one
suppresses the formula. The name can be read two ways and the CSV alone does not
decide it:

- as **two** heavy atoms — the whole ketene fragment, C=C=O
- as **one** heavy atom, `[COd]`, whose value depends on what the neighbouring
  `Cd` carries, with that `Cd` counted separately from its own row

Three things point at the second reading:

1. This data set already has a convention for one value covering two groups —
   `Ct-(CB) + CB-(Ct)` in `01_CH_Groups.csv` writes the two out and joins them
   with `+`. These rows do not.
2. Read the second way, ketene is `[COd]-Cd(H)2` + `Cd-(H)2` = −78 + 26.2 =
   −51.8 kJ/mol, against a measured −48 ± 2 (Nuttall, Laufer et al. 1971, via
   the NIST Chemistry WebBook) — an ordinary Benson-sized error. Read the first
   way it would be −78 on its own, out by about 30 kJ/mol.
3. The literature on ketene group values holds that the ketene function cannot
   be captured by a single additivity term, which is what a substitution-
   dependent `[COd]` term is for.

If that is right, all four contribute `C O` and the `(H)2` is describing the
neighbour rather than this group's own hydrogens. It is a chemist's call, not a
programmer's, so the rows stay `unknown` until someone checks them against
Cohen & Benson (1993). Changing four cells in this file is the whole fix.

## synonyms.csv

Names students actually type. `C-(C)(H)3` is a methyl group, but nobody searches
for it that way, so the file lets "methyl" find it. One row per synonym, so a
group can have several.

Searching already understands the notation without any help here — typing `CH3`
finds `C-(C)(H)3` because the group is a carbon with three H ligands. This file
is only for names that cannot be worked out from the notation.

Every name in the first column must be a group that really exists in
`CSV_data_files/`; `python tools/validate_data.py` checks that, so renaming a
group cannot quietly orphan its synonym.
