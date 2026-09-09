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
[@benson1976; @cohen1993]. It is taught in physical and organic chemistry
courses because it makes the relationship between structure and energy
explicit: a student who can break a molecule into groups has understood
something the final number alone does not convey.

The Benson Increments Calculator is a browser tool that supports that
exercise without performing it. It presents all 236 published increments and
corrections as searchable, clickable values, and the student decides which
ones the molecule requires. The tool keeps a running total in kJ/mol and
kcal/mol, shows each contribution beside the total, and produces the working
as plain text that can be pasted into a report.

It runs in any browser with nothing to install, on a laptop or a phone, and
has no build step, no framework and no external dependency — the typeface is
served from the repository rather than a font CDN, so the tool works in a
teaching lab with no internet once the page has loaded.

# Statement of need

Existing open-source implementations of Benson group additivity assign the
groups automatically from a structure. RMG-Py's thermochemistry estimator
[@rmgpy] and pGrAdd [@pgradd] both take a SMILES or InChI string and return an
estimate. That is the right design for generating kinetic mechanisms over
thousands of species, and the wrong one for a course, because it performs the
step the student is meant to perform. Both also require a Python environment,
which is a barrier in a teaching lab and impossible on a phone.

The alternative students are otherwise given is a printed table. The values
are spread over several tables in notation that is unfamiliar on first sight —
`C-(C)2(H)2`, `Cd-(CB)(H)` — and a look-up error is invisible in the final
answer, so a wrong total and a misunderstood method are indistinguishable to
the student and to the marker.

This tool sits between the two. The decomposition stays with the student; the
arithmetic, the unit conversion and the bookkeeping do not.

Three design decisions follow from teaching rather than from computing, and
they are the substance of the contribution:

**It refuses to add quantities that are not the same quantity.** The tool
includes cyclohexane A-values, which are conformational free energies, not
enthalpies of formation. A running total that silently added one to the other
would be arithmetically fine and physically meaningless. Each category
declares what it holds, and the total heads itself $\Delta H_f^\circ$ only
while every chosen value is an enthalpy; otherwise it says plainly what it has
been mixed with.

**It shows what the source actually published.** Fifteen of the twenty-nine
A-values are published as ranges. The tool sums the midpoint, displays the
published range beside it, and reports how far the total could move if every
range were read at its bounds. Values are shown to the precision the source
claims, so an integer increment is not rendered with two invented decimal
places.

**It says what it does not know.** Four notation entries whose meaning could
not be confirmed against a source are marked unconfirmed on the reference
page rather than glossed confidently, and a discrepancy found in the atom
accounting is documented rather than quietly patched. A teaching tool that
hides its uncertainty teaches the wrong lesson about how chemistry is known.

The accompanying reference page — generated from Markdown and CSV files that a
chemist can edit without touching code — covers the method, the notation, a
glossary, three worked examples checked against measured values from the NIST
Chemistry WebBook [@nist], and the sources.

# Story of the project

The calculator began as a Jupyter notebook written for Chemistry C450/C540 at
Indiana University Bloomington, and that notebook is still in the repository
and still serves as the reference implementation. Students used it in class,
which surfaced the practical problem: a notebook needs a Python environment,
and the friction of getting one running consumed time meant for chemistry.

The web version was written to remove that friction while keeping the
pedagogy. Its increment values are checked against the notebook's own parsing
rules on every commit, so the two cannot disagree, and a test holds that
comparison honest by reading the notebook itself.

# Acknowledgements

Developed for students of Chemistry C450/C540 at Indiana University
Bloomington. Generative AI assistance was used in developing this software and
its documentation; the nature and extent of that assistance is recorded in
`AI_USE.md` in the repository.

# References
