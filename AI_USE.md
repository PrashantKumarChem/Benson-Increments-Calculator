# Use of AI assistance in this project

This file records where generative AI was used in building the Benson
Increments Calculator, so that any disclosure required by a journal can be
written from a record rather than from memory.

**Every line below is a claim about what happened. The human authors are
responsible for its accuracy and should correct anything that has drifted
before it is used in a submission.**

## The short version

No number a reader sees was produced by AI. The increment values are read from
the CSV files in `CSV_data_files/`, which come from the published literature
and are unchanged. Software written with AI assistance surrounds those values;
it does not generate them.

## What AI was used for

**Tool:** Anthropic Claude (Opus 5), used interactively through Claude Code.
Work took place during 2026.

- **Code.** Most of the JavaScript, Python and CSS in `assets/` and `tools/`
  was drafted with AI assistance: the reading and parsing of the CSV data, the
  search index, the running total, the rendering, the test suites, and the
  validation and build tooling.
- **Documentation and prose.** `README.md`, the explanatory comments through
  the source, `notation/README.md`, and the first drafts of the reference page
  in `reference/` were drafted with AI assistance.
- **Literature look-up.** Bibliographic details in
  `reference/11_Sources_and_References.md` were retrieved with AI assistance
  from Crossref, publisher records and the NIST Chemistry WebBook, and were
  checked against those sources.

## What AI was *not* used for

- **The increment data.** No value in `CSV_data_files/` was generated,
  estimated, altered or interpolated by AI. The values are transcribed from
  the published source.
- **Measured comparison values.** The experimental enthalpies quoted in the
  worked examples are taken from the NIST Chemistry WebBook and are cited.
- **Chemical judgement.** Where the chemistry could not be established from a
  source, the answer is recorded as unresolved rather than filled in. See
  `reference/06_What_Is_Not_Yet_Confirmed.md` and the open question in
  `notation/README.md`.

## What the human authors did

- Made the design decisions: what the tool does and refuses to do, that it does
  not parse structures, how categories are declared, whether the reference page
  is a page or a view, how it is versioned, and what goes in it.
- Set the constraints the code is written to: no build step, no external
  dependency, no CDN, no web font, everything open source and attributed.
- Verified the chemistry, and are responsible for it.
- Rewrote the prose. <!-- Update this line to describe what you actually
     rewrote before submitting; it should not claim more than is true. -->

## What has been checked, and how

- `tools/check_parity.mjs` loads all 236 increments twice — once through the
  original notebook's code, once through the site's — and fails on any
  difference. Agreement on every increment means agreement on every total.
- `tools/validate_data.py` checks the data files for missing values, duplicate
  names, malformed rows and a stale manifest.
- `node --test tools/*.test.mjs` covers value parsing, the tally, formatting,
  browsing, notation, the stylesheet and the reference renderer.
- CI runs all of the above on every push and pull request.
- The chemistry on the reference page was checked against Cohen and Benson
  (1993), Benson (1976), Ashcraft and Green (2008) and the NIST Chemistry
  WebBook. Entries that have not been checked say so, in the "Checked against"
  column of `reference/05_Notation.csv`.

## One correction this record should not omit

An earlier draft of the reference page carried an invented title for the Cohen
and Benson paper. It was caught in review against Crossref and replaced with
the correct title, page range and DOI. It is recorded here because a
disclosure that only lists successes is not a disclosure.

## For a submission

- **JOSS** requires an *AI usage disclosure* section in the paper giving the
  tools and versions used, where they were used, the nature and scope of the
  assistance, and an explicit assertion that the human authors reviewed,
  edited and validated all AI-assisted output and made the core design
  decisions. Non-disclosure is treated as an ethical breach.
- **ACS journals**, including the *Journal of Chemical Education*, do not
  permit AI tools as authors and require disclosure in the Acknowledgement,
  with fuller detail in the Methods where the use is substantial. The use here
  is substantial.

Both are satisfied by a short statement in the paper that points at this file —
but the assertion about human review has to be true, and only the authors can
make it.
