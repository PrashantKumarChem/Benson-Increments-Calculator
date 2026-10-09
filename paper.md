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
organic molecule by adding up contributions from the groups the molecule
contains [@benson1976; @cohen1993]. The Benson Increments Calculator is a
browser tool that does the adding. The student does the harder part: deciding
which groups a molecule has.

All 236 increments and corrections are listed, searchable and clickable. The
student picks the ones a molecule needs. The tool keeps a running total in
kJ/mol and kcal/mol, shows each contribution beside it, and gives the full
calculation as plain text that can be pasted into a report.

The tool runs in any web browser, on a laptop or a phone, and needs no
installation. The code and the increment data are open source. The increments
are a hand-curated data file, starting from the tables in Anslyn and Dougherty's
textbook [@anslyn2006], and they are stored as plain CSV files, so the same
kind of calculator can be built from other tables.

# Statement of need

Programs for Benson group additivity already exist, and most of them assign the
groups automatically. RMG-Py's thermochemistry estimator [@rmgpy] and pGrAdd
[@pgradd] take a SMILES or InChI string and return an estimate. That design
suits generating kinetic mechanisms for thousands of species. In a course, it
removes the step the student is meant to learn. Both programs also need a
Python environment, which is a barrier in a teaching lab and hard to run on a
phone.

The usual alternative is a printed table. Cohen and Benson's values are spread
over several tables, written in shorthand such as `C-(C)2(H)2` and `Cd-(CB)(H)`.
A lookup error then hides inside the arithmetic, so a wrong total and a
misunderstood method look the same on the page.

This tool sits between the two. The student still chooses the groups. The
calculator does the addition, the unit conversion and the bookkeeping. The aim
is to build an understanding of what sits behind a group-additivity estimate.
We consider that understanding a prerequisite before a student relies on
AI-based or other more complex methods for numerical values.

The calculator also shows what the source actually published. Fifteen of the
twenty-nine A-values are given as ranges. The calculator uses the midpoint,
shows the range beside it, and reports how far the total could move if every
value were taken at the end of its range. Values keep the precision of their
source, so an integer increment does not gain decimal places.

# Use in teaching

The calculator was written for Advanced Organic Chemistry (C450/C540) at Indiana
University Bloomington, and it has been used in class for three years. It
began as a Jupyter notebook, which is still in the repository and still serves
as the reference version. A notebook needs a Python installation, and setting
one up took time away from the chemistry, so the web version was made to remove
that step.

Using the tool in class has taught two things at once. Students learn the
increments, which is the chemistry. They also learn the workflow that links a
notebook to Python and to GitHub: they run Python from Jupyter, and they look at
how a code repository is organised and written. The web page adds a third
benefit. Students can calculate on a phone at any time, and the page makes them
decide which group contributions a molecule needs.

The routine addition, which used to take class time, is now done by the
calculator. Class time goes to choosing the groups and discussing the results,
and the work is more enjoyable for students.

# Acknowledgements

Developed for students of Advanced Organic Chemistry (C450/C540) at Indiana
University Bloomington. Generative AI assistance was used in developing the
software and its documentation. The nature and extent of that assistance is
recorded in `AI_USE.md` in the repository.

# References

<!--
  Material held back for later. Not part of the paper text. Each line is a
  pointer to incorporate once the item is checked.

  - Dealing with mixed kinds of quantity: the calculator will not add
    quantities of different kinds. Cyclohexane A-values are free energies of
    conformational change, not enthalpies of formation. The total is labelled
    as an enthalpy only while every value in it is one. Possible section:
    Statement of need, after the ranges point.

  - Stating what it does not know: four notation entries whose meaning could
    not be confirmed are marked unconfirmed on the reference page, and a
    discrepancy in the atom count is documented rather than silently fixed.
    Confirm the four entries and the discrepancy wording before using.

  - Reference page contents: the method, the notation, a glossary, three
    worked examples with values from the NIST Chemistry WebBook [@nist], and
    the sources. Generated from Markdown and CSV files a chemist can edit.
    The NIST comparison is not yet verified; check before stating it.
-->
