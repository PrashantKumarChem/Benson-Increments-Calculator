---
paths:
  - "CSV_data_files/**"
  - "notation/**"
  - "tools/**"
---

# Citing a value that came from outside this repository

Every number here that was not computed here is a claim about the literature.
Students and reviewers cannot check the chemistry by reading our code, so the
citation is the only thing standing between a published value and a rumour.

Two properties matter, and they are separate:

- **Attributable** — a reader can tell exactly which work the number came from.
- **Retrievable** — a reader can reach that work in one click and read it.

A short author-year string is attributable and not retrievable. A bare URL is
retrievable and often not attributable. Cited values need both.

---

## What every cited value carries

1. **The value as the source states it**, with the source's own uncertainty.
   Do not round it, re-derive it, or silently convert units.
2. **A full bibliographic citation** — authors, title, journal, year, volume,
   pages. Not "Pilcher 1972".
3. **A resolvable link** — a DOI (`https://doi.org/10.xxxx/...`) where one
   exists, otherwise a stable database URL that shows the value itself.
4. **The method**, where the source gives one. `Ccb` and `Eqk` are not the same
   kind of evidence, and a reader comparing two values needs to know which.

---

## Never write a citation from memory

**This is the rule that matters most, and it applies to assistants especially.**

A recalled citation is indistinguishable from a correct one until somebody
checks it. A recalled DOI is worse: it looks precise, it resolves to *something*
or to nothing, and the reader who follows it has no reason to suspect the value
attached to it. A fabricated citation makes a test that asserts a wrong number
is right, while looking like verification — strictly worse than no citation.

So:

- **Retrieve every field.** Open the source, or the database record, and copy
  what it says. If you did not fetch it in the session that wrote it down, you
  do not have it.
- **Never compose a DOI.** DOIs are opaque. `10.1021/ja00730a025` cannot be
  derived from a journal and a page number; guessing the suffix pattern from
  another paper in the same journal produces a plausible string that points
  somewhere else. Resolve it — Crossref's `works?query.bibliographic=` endpoint
  takes a citation and returns the record.
- **Confirm the record is the right paper.** Compare the returned title,
  journal, volume, first page and year against the citation you started from.
  Crossref returns a best guess, not a match; its top hit for a 1960 *Bull. Soc.
  Chim. France* paper was a 1984 encyclopedia entry.
- **Check the link resolves.** A `404` citation is worse than none, because it
  reads as checkable. A `403` from a paywalled publisher is fine — the DOI
  resolved and the reader can see what it points at.

## Two independent sources beat one

Where a value's citation can be corroborated by a second, independent record —
the database's printed reference *and* the publisher's own metadata, say — say
so. That is what makes the provenance robust against a transcription slip on
either side, rather than merely stated.

## Short-form references collide, and the collision is silent

Author-year strings are not identifiers. Two real examples from this project's
own data:

| Short form | Actually two different papers |
|---|---|
| Prosen and Rossini, 1945 | the paraffin hydrocarbons (*J. Res. NBS* **34**, 263) **and** 1,3-butadiene and styrene (*J. Res. NBS* **34**, 59) |
| Prosen, Johnson, et al., 1946 | the alkylcyclopentanes and cyclohexanes (*J. Res. NBS* **37**, 51) **and** the alkylbenzenes (*J. Res. NBS* **36**, 455) |

Both pairs are the same authors in the same year in the same journal. Recording
only the short form loses which paper a value came from, and nothing downstream
can recover it. This is why the full citation is required rather than preferred.

## Pick between competing values by a stated rule, not per value

A database will often list several determinations. Choosing the one nearest our
own answer is data dredging, and it is invisible in the result. Write the
selection rule down **before** looking at the values, apply it to every entry,
and record what it rejected and why. If the rule has to change, change it for
every entry and re-check the ones already taken.

## When no source can be retrieved, drop the value

Not estimate it. Not recall it. Not carry it over from earlier work whose
provenance is unknown. Drop it, and say in the pull request which values were
dropped and why. Ten cited values are worth more than thirty half-sourced ones,
because the thirty cannot be told apart.

Also drop a value whose own uncertainty is too large to support the claim being
made — a figure known to ±10 kJ/mol cannot adjudicate a method whose error is
5.5.

---

## Before you commit

- [ ] Every new or changed value has authors, title, journal, year, volume, pages
- [ ] Every citation has a DOI, or a stable URL, and it was **fetched** not recalled
- [ ] Every link was followed and resolves
- [ ] The record's title and volume match the citation they are attached to
- [ ] The rule used to choose between competing values is written down
- [ ] Dropped values are listed, with the reason

Anything you could not retrieve is stated plainly as not retrieved. That is a
finding, not a failure — see the prime directive in
[`AGENTS.md`](../../AGENTS.md): verify, do not assert.
