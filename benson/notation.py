"""What a group name means.

Will own the rules currently in `assets/notation.js` — the larger half of the
extraction, and the one where a rule is easiest to lose:

- decomposing `C-(C)2(H)2` into a central atom and its ligands
- element composition, and the molecular formula a set of groups adds up to
- the search keys a student actually types, including synonyms
- the notation data in `notation/` that says what cannot be derived from a name

Only the composition syntax has moved in so far. It is still written twice:
here, and again in `assets/notation.js`, which reads compositions by the same
rule. Porting that file is what makes it once.
"""
import re

# "C", "N O2", "C2" - element symbols separated by spaces, each with an
# optional count.
COMPOSITION_RE = re.compile(r"^[A-Z][a-z]?\d*(?:\s+[A-Z][a-z]?\d*)*$")
