---
paths:
  - "tools/*.test.mjs"
  - "tools/thermochemistry_data.mjs"
---

# Citing a published value in a test

A test that compares the calculator against the literature is only as good as
its citations. Nobody can check the chemistry by reading the code, so the
citation is the only thing standing between a published value and a rumour.

This rule covers tests, and `tools/thermochemistry_data.mjs`, where the
thermochemistry test keeps its cited values. The increment data files are
covered by [`data.md`](data.md), and a two-column data row has nowhere to keep
the fields below — do not try to add them there.

Two properties matter, and they are separate:

- **Attributable** — a reader can tell exactly which work the number came from.
- **Retrievable** — a reader can reach that work in one click and read it.

A short author-year string is attributable and not retrievable. A bare URL is
retrievable and often not attributable. A cited value needs both.

---

## What every cited value carries

1. **The value as the source states it**, with the source's own uncertainty.
   Do not round it, re-derive it, or silently convert units.
2. **A full bibliographic citation** — authors, title, journal, year, volume,
   pages. Not "Pilcher 1972".
3. **A resolvable link** — a DOI where one exists, otherwise a stable database
   URL that shows the value itself.
4. **The method**, where the source gives one. `Ccb` and `Eqk` are not the same
   kind of evidence, and a reader comparing two values needs to know which.
5. **Every work the source's own notes name.** A database row can say
   "Reanalyzed by …, Original value = …" or "Hf by …". That changes whose number
   it is. Read the whole row, including its comment, and cite each work it names.

---

## Never write a citation from memory

**This is the rule that matters most, and it applies to assistants especially.**

A recalled citation looks exactly like a correct one until somebody checks it.
A recalled DOI is worse: it looks precise, and it may resolve to a real paper
that is not the one cited. A fabricated citation turns a test into an assertion
that a wrong number is right, while looking like verification.

- **Retrieve every field.** Open the source, or the database record, and copy
  what it says. If it was not fetched in the session that wrote it down, it is
  not known.
- **Never compose a DOI.** DOIs are opaque, and a near miss is not harmless:
  `10.1021/ja00730a025` is a 1971 *J. Am. Chem. Soc.* paper on bridgehead
  nitriles, and `10.1021/ja00730a026` is a real, unrelated paper on carbonium
  ions in the same journal, volume and year. Journal, volume and year cannot
  tell them apart; only the title and the first page can.
- **A search finds candidates; it does not verify.** A bibliographic search
  returns a best guess. Its top hit for one 1960 *Bull. Soc. Chim. France* paper
  was a 1984 encyclopedia entry.
- **Verify by exact lookup.** Request `https://doi.org/<doi>` with
  `Accept: application/vnd.citationstyles.csl+json`, and compare the returned
  title, year, type, authors and first page with the citation. A database's own
  DOI may carry no page; compare what the record has, and say what it did not.
- **A matching title is not a matching work.** A book review in a journal
  carries the book's title and year. For one 1970 monograph cited in the
  thermochemistry test, the only records carrying its exact title were reviews
  of it - a `journal-article`, not a `book` - and a title-and-year check
  accepted one. Compare the type and the authors too - as a set, because two
  records of the same paper can list its authors in a different order.
- **Check the link resolves.** A dead citation is worse than none, because it
  reads as checkable.

## A format check is not verification

An assertion that a DOI matches `/^10\.\d{4,9}\/\S+$/` proves it is well-formed
and nothing more. Say so beside the assertion. Do not describe it as catching a
wrong DOI — it cannot, and a guard that claims more than it checks is worse than
no guard, because it is trusted.

## Short-form references collide, and the collision is silent

Author-year strings are not identifiers. Two examples from this repository's own
thermochemistry test:

| Short form | Actually two different papers |
|---|---|
| Prosen and Rossini, 1945 | the paraffin hydrocarbons (*J. Res. NBS* **34**, 263) **and** 1,3-butadiene and styrene (*J. Res. NBS* **34**, 59) |
| Prosen, Johnson, et al., 1946 | the alkylcyclopentanes and cyclohexanes (*J. Res. NBS* **37**, 51) **and** the alkylbenzenes (*J. Res. NBS* **36**, 455) |

Same authors, same year, same journal. Recording only the short form loses which
paper a value came from, and nothing downstream can recover it.

## Pick between competing values by a stated rule, not per value

A database often lists several determinations. Choosing the one nearest the
calculator's answer is data dredging, and it is invisible in the result. Write
the selection rule down **before** looking at the values, apply it to every
entry, and record what it rejected and why. If the rule has to change, change it
for every entry and re-check the ones already taken.

## When no source can be retrieved, drop the value

Do not estimate it, recall it, or carry it over from earlier work whose
provenance is unknown. Drop it, and say in the pull request which values were
dropped and why. Ten cited values are worth more than thirty half-sourced ones,
because the thirty cannot be told apart.

Also drop a value whose own uncertainty is too large to support the comparison —
a figure known to ±10 kJ/mol cannot adjudicate a method whose error is 5.5.

---

## Before you commit

- [ ] Every cited value has authors, title, journal, year, volume and pages
- [ ] Every field was **fetched** in the session that wrote it, not recalled
- [ ] Each source row's comment was read, and every work it names is cited
- [ ] Every DOI was verified by exact lookup - title, year, type, authors - not by search
- [ ] Every link was followed and resolves
- [ ] Any format-only check says it is format-only
- [ ] The rule used to choose between competing values is written down
- [ ] Dropped values are listed, with the reason

Anything that could not be retrieved is stated plainly as not retrieved. That is
a finding, not a failure — see the prime directive in
[`AGENTS.md`](../../AGENTS.md): verify, do not assert.
