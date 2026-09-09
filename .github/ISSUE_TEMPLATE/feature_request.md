---
name: Feature request
about: Suggest an addition or a change
title: ''
labels: enhancement
assignees: ''

---

**What are you trying to do?**
Describe the task, ideally with the molecule or the situation that prompted
this. What the calculator should do is usually clearer from the problem than
from a proposed solution.

**What happens now**
What you have to do instead today, and where it breaks down.

**What you would like instead**

## If you are proposing new increment values

Values are welcome. Please include:
- The category they belong to, or that a new one is needed
- The source, with enough detail to look it up — author, journal, year, volume,
  page, and a DOI if there is one
- Whether any value is published as a range

New categories need no code: a two-column CSV in `CSV_data_files/` is the whole
of it. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Before proposing automatic structure input

Requests to accept a SMILES string, or a drawn structure, and work out the
groups automatically come up often, and the answer is deliberate rather than a
matter of effort.

Choosing the groups is the skill this tool exists to teach. Software that does
it for you already exists and is good — RMG-Py and pGrAdd both assign Benson
groups automatically — and either is the better choice when the goal is
throughput rather than learning. See the statement of need in the
[README](../../README.md).

That does not make the idea unwelcome; it means a proposal needs to say how it
would help someone learning the method rather than bypass it.

**Anything else**
