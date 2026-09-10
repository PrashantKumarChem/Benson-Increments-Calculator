---
paths:
  - "assets/**"
  - "index.html"
---

# Working with the browser assets

## The DOM-free modules

Seven modules under `assets/` do not touch the DOM: `benson`, `browse`,
`format`, `notation`, `selection`, `sheet`, `theme`. That is deliberate and it is
what lets them be unit-tested with no browser at all.

**Do not introduce DOM access into one.** If a decision needs testing and
currently lives in `app.js`, the fix is to move the decision out, not to move a
test in. `app.js` is the wiring — building HTML, attaching listeners, reading
elements — and it is the one file the unit tests do not cover.

## No runtime dependencies

`git clone && node --test tools/*.test.mjs` working on a clean machine with
nothing installed is a property worth keeping. The only exception is Playwright,
which `check_render.mjs` needs and which is installed outside the repository.

## The asset version

`tools/build_version.py` writes a hash of the stylesheet and the modules into
**ten** slots in `index.html`: the stylesheet link, eight import-map entries, and
the module `src`.

Change anything under `assets/` and you must regenerate it:

```bash
python tools/build_version.py
python tools/validate_assets.py
```

Skipping this means a returning visitor can be served a cached module under a
string claiming to be current. GitHub Pages caches each file for ten minutes,
and each file's ten minutes start when that file was last fetched — so a visitor
can get a fresh `index.html` and a stale `app.js`. That is how the site once
ended up stuck on "Loading increment data".

`validate_assets.py` checks that the ten slots agree with each other. It cannot
check that the version *moved*; that is what the CI step comparing a regenerated
`index.html` is for.

**The two font files are the exception.** They are named from `styles.css`, not
from `index.html`, and they are immutable — replacing a face means a new
filename, not a new version string. Do not add `?v=` to them.

## CSS fails quietly

`node tools/validate_css.mjs` checks the stylesheet parses and that every token
it names is declared. That is necessary and not sufficient.

**`node tools/check_render.mjs` is not optional when you touch CSS, HTML, or
anything affecting how the page loads.** Every other check in this repository
reads the source. The faults that have actually reached this site are the ones
only a browser can see, and there have been two:

- A comment closed early, the browser swallowed the media query that followed,
  and the running total stopped existing on desktop.
- A transition was left chasing a height that had already changed, so the phone
  sheet jumped on every pick, for months.

Every check passed both times. A person looking at the page caught both.

`check_render.mjs` loads the page at 320, 390 and 1180 px, with and without
increments chosen, and checks that the total is on screen, that it sits beside
the increments on a wide screen, that adding one does not move the sheet, and
that nothing spills sideways.
