## What this changes

Briefly, and why.

## Type of change

- [ ] Increment data (new or corrected values)
- [ ] Calculator behaviour
- [ ] Reference page or other documentation
- [ ] Tooling, tests or CI
- [ ] Other:

## Checks

Run these locally. CI runs them too, so anything missed will go red rather
than be merged by accident.

- [ ] `python tools/validate_data.py`
- [ ] `python tools/validate_assets.py`
- [ ] `node --test tools/*.test.mjs`
- [ ] `node tools/validate_css.mjs`
- [ ] `node tools/check_parity.mjs`
- [ ] `node tools/build_reference.mjs --check`

## If you changed anything in `assets/`

- [ ] I bumped the version in `index.html`, in every place it appears

This is the one step CI cannot verify. `validate_assets.py` checks that the
version references agree with each other, not that you moved them, so a missed
bump passes every check and can serve a returning visitor a stale file. Count
the places rather than assuming a number — it grows when a module is added. A
value already in use is not a bump; a second release on the same day takes a
letter suffix.

## If you changed data or the reference page

- [ ] New or changed values include a source
- [ ] `CSV_data_files/manifest.json` regenerated and committed, if a file was added
- [ ] `reference.html` rebuilt, if anything in `reference/` or an included CSV changed

## Anything else

Screenshots for a visual change, and anything a reviewer should know.
