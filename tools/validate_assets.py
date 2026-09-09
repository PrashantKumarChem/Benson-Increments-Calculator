"""Check that index.html asks for every asset by version.

GitHub Pages serves each file with Cache-Control: max-age=600, and each file's
ten minutes begin when that file was last fetched, so they expire at different
moments. There is therefore always a window in which a returning visitor gets
index.html fresh and assets/app.js from cache. That has already broken the site
once: an older app.js looked for a #tabs element the current page does not
have, threw, and left it saying "Loading increment data" for ever.

Asking for every asset with a version in its URL closes the window, because a
page can only request the assets it names, and it names them all.

What this file checks is the mistake that is actually available to make. Nobody
forgets the version on the stylesheet - the page looks wrong at once. What is
easy is to add a seventh module and not list it in the import map, or to bump
five versions out of six. Either leaves one file loading stale while everything
round it is current, and a stale assets/notation.js does not announce itself:
it drops the source precision from each value, so -20.9 renders as -21. A wrong
number on a calculator is worse than a blank page, and it is the outcome this
file exists to prevent.

    python tools/validate_assets.py
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PAGE = "index.html"
ASSET_DIR = "assets"

#: An href= or src= pointing into assets/, with its version if it has one.
ASSET_REF_RE = re.compile(
    r'["\'](?:\./)?' + ASSET_DIR + r'/([A-Za-z0-9_.-]+)(?:\?v=([^"\']*))?["\']')
IMPORT_MAP_RE = re.compile(r'<script\s+type="importmap"\s*>(.*?)</script>', re.S)


def modules(asset_dir: str = ASSET_DIR) -> set[str]:
    """Every JavaScript module the browser could be asked to load."""
    return {name for name in os.listdir(asset_dir) if name.endswith(".js")}


def main() -> int:
    if not os.path.exists(PAGE):
        print(f"{PAGE} is missing", file=sys.stderr)
        return 1

    problems: list[str] = []
    versions: set[str] = set()
    page = open(PAGE, encoding="utf-8").read()
    import_map = IMPORT_MAP_RE.search(page)

    # An import map's keys are deliberately unversioned - a key is the URL being
    # remapped *from* - so the map is read on its own terms rather than being
    # mistaken for a page full of unversioned requests.
    for name, version in ASSET_REF_RE.findall(IMPORT_MAP_RE.sub("", page)):
        if version:
            versions.add(version)
        else:
            problems.append(f"{PAGE}: 'assets/{name}' is requested without a ?v= version")

    if not import_map:
        problems.append(f"{PAGE}: no import map, so a module's own imports go unversioned")
    else:
        try:
            mapped = json.loads(import_map.group(1)).get("imports", {})
        except json.JSONDecodeError as exc:
            problems.append(f"{PAGE}: the import map is not valid JSON ({exc.msg})")
            mapped = {}

        for key, target in sorted(mapped.items()):
            name = key.rsplit("/", 1)[-1]
            if "?v=" in target:
                versions.add(target.split("?v=", 1)[1])
            else:
                problems.append(f"{PAGE}: the import map sends assets/{name} to an "
                                "unversioned URL, so it would still be served from cache")

        listed = {key.rsplit("/", 1)[-1] for key in mapped}
        for name in sorted(modules() - listed):
            problems.append(
                f"{PAGE}: assets/{name} is not in the import map, so anything importing "
                "it would load a cached copy while the rest of the page is current")
        for name in sorted(listed - modules()):
            problems.append(f"{PAGE}: the import map lists assets/{name}, which does not exist")

    # One release, one version: a half-bumped page mixes old files with new.
    if len(versions) > 1:
        problems.append(f"{PAGE}: more than one version in use "
                        f"({', '.join(sorted(versions))}) - every asset should carry the same one")
    if any(not version for version in versions):
        problems.append(f"{PAGE}: an asset carries an empty ?v=")

    if problems:
        print(f"{len(problems)} problem(s) found:\n", file=sys.stderr)
        for problem in problems:
            print(f"  {problem}", file=sys.stderr)
        print("\nThe version lives in index.html and nowhere else.", file=sys.stderr)
        return 1

    print(f"OK - {len(modules())} modules and the stylesheet all requested at "
          f"version {versions.pop() if versions else '?'}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
