---
title: 'Benson Increments Calculator: a browser tool for learning group additivity by doing it'
tags:
  - chemistry education
  - thermochemistry
  - group additivity
  - enthalpy of formation
  - JavaScript
authors:
  - name: Prashant Kumar
    orcid: 0000-0000-0000-0000
    affiliation: 1
  - name: Nicola L. B. Pohl
    orcid: 0000-0000-0000-0000
    affiliation: 1
affiliations:
  - name: Department of Chemistry, Indiana University Bloomington, Indiana, USA
    index: 1
date: 9 September 2026
bibliography: paper.bib
---

<!-- The two orcid: values above are placeholders and must be replaced before
     submission. See the header of CITATION.cff. -->

# Summary

Benson group additivity estimates the standard enthalpy of formation of an
organic molecule by adding up contributions from the groups it is made of
[@benson1976; @cohen1993]. We teach it because it makes the link between
structure and energy explicit. A student who can break a molecule into groups
has understood something the final number does not convey on its own.

The Benson Increments Calculator supports that exercise without performing it.
All 236 published increments and corrections appear as searchable, clickable
values, and the student decides which ones a molecule needs. The tool keeps a
running total in kJ/mol and kcal/mol, shows each contribution beside it, and
will hand back the whole calculation as plain text to paste into a report.

It runs in any browser with nothing to install, on a laptop or a phone. There
is no build step, no framework and no external dependency; even the typeface
ships with the repository, so the page keeps working in a teaching lab after
the network drops.

# Statement of need

Software for Benson group additivity already exists, and it assigns the groups
for you. RMG-Py's thermochemistry estimator [@rmgpy] and pGrAdd [@pgradd] both
take a SMILES or InChI string and return an estimate. For generating kinetic
mechanisms across thousands of species that is the correct design. For a course
it defeats the purpose, because the assignment is the thing being learned. Both
also need a Python environment, which is friction in a teaching lab and simply
impossible on a phone.

The usual alternative is a printed table. Cohen and Benson's values are spread
over several tables in notation that is opaque on first sight: `C-(C)2(H)2`,
`Cd-(CB)(H)`. A look-up error then disappears into the arithmetic, so a wrong
total and a misunderstood method look identical on the page. Neither the
student nor the marker can tell them apart.

This tool sits between the two. The student keeps the decomposition. The
calculator takes the arithmetic, the unit conversion and the bookkeeping.

What distinguishes it is a set of refusals, and they come from teaching rather
than from software design.

The first is that it will not add quantities that are not the same quantity.
Cyclohexane A-values are conformational free energies, not enthalpies of
formation, and a running total that quietly added one to the other would be
arithmetically sound and physically meaningless. Every category declares what
it holds. The total heads itself $\Delta H_f^\circ$ only while every value in
it is an enthalpy, and otherwise says plainly what it has been mixed with. This
is the behaviour we most wanted, because the mistake it prevents is one
students make without noticing.

It also shows what the source actually published. Fifteen of the twenty-nine
A-values are published as ranges; the calculator sums the midpoint, displays
the range beside it, and reports how far the total could move if every range
were read at its bounds. Values appear at the precision their source claims, so
an integer increment never acquires two invented decimal places.

Last, it says what it does not know. Four notation entries whose meaning we
could not confirm against a source are marked unconfirmed on the reference
page, and a discrepancy found in the atom accounting is documented instead of
quietly patched. A teaching tool that conceals its uncertainty teaches the
wrong lesson about how chemistry is known.

The reference page covers the method, the notation, a glossary, three worked
examples checked against measured values from the NIST Chemistry WebBook
[@nist], and the sources. It is generated from Markdown and CSV files a chemist
can edit without touching any code.

# Story of the project

The calculator began as a Jupyter notebook written for Chemistry C450/C540 at
Indiana University Bloomington. That notebook is still in the repository and
still serves as the reference implementation. Using it in class exposed the
practical problem: a notebook needs a Python environment, and the time spent
getting one running was time taken from chemistry.

We wrote the web version to remove that friction and keep the pedagogy. Its
values are checked against the notebook's own parsing rules on every commit, so
the two cannot disagree, and a test reads the notebook itself to keep that
comparison honest.

# Acknowledgements

Developed for students of Chemistry C450/C540 at Indiana University
Bloomington. Generative AI assistance was used in developing this software and
its documentation; the nature and extent of that assistance is recorded in
`AI_USE.md` in the repository.

# References
