"""What a group name means.

Will own the rules currently in `assets/notation.js` — the larger half of the
extraction, and the one where a rule is easiest to lose:

- decomposing `C-(C)2(H)2` into a central atom and its ligands
- element composition, and the molecular formula a set of groups adds up to
- the search keys a student actually types, including synonyms
- the notation data in `notation/` that says what cannot be derived from a name

The composition rule is written twice today: `COMPOSITION_RE` in
`tools/benson_data.py`, and the same rule again in `assets/notation.js`. Here it
is written once.
"""
