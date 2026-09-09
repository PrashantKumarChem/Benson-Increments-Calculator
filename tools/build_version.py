"""Write the asset version in index.html from the assets themselves.

The version exists so that a returning visitor cannot be served a stale module
under a string saying it is current. index.html explains why; this file decides
what the string is.

It used to be a date with a letter after it, chosen by hand, and the rule was
"a value already in use is not a bump". That rule cannot be checked by looking
at the page - only by reading every version the branch has ever carried - so CI
grew a step that walks the history of index.html to find out. It also has a
ceiling nobody planned: one session that touches assets/ a few times spends
five or six letters, and the letters do not come back, because reusing one is
the exact failure the versioning prevents.

A hash of the files removes both problems at once, and removes the judgement
too. Different bytes give a different string, by construction, so a bump can no
longer be forgotten, mis-typed, or picked twice by two branches that never saw
each other. There is nothing to remember and nothing to look up.

It stays a generated file checked by `git diff --exit-code`, which is how
CSV_data_files/manifest.json is already kept honest - not a build step the site
needs, but a file a human could edit wrongly and a machine can confirm.

    python tools/build_version.py           # rewrite index.html
    python tools/build_version.py --check    # say what it would be, change nothing

Only the files index.html versions are hashed: the stylesheet and the modules.
The fonts under assets/fonts/ are deliberately not, because the stylesheet asks
for them by a plain relative URL with no version on it - including them here
would move the version without moving the URL that would have to change for a
new font to reach anybody. That gap is real and predates this file; a font is
also the one asset whose bytes almost never change without its name changing.
"""
from __future__ import annotations

import hashlib
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PAGE = "index.html"
ASSET_DIR = "assets"
#: Long enough that a collision is not a thing to think about, short enough to
#: read in a URL and to say out loud in a bug report.
LENGTH = 10
VERSION_RE = re.compile(r'(\?v=)([^"\']*)')


def versioned_assets(asset_dir: str = ASSET_DIR) -> list[str]:
    """The files index.html carries a version for, in a fixed order.

    Sorted, because the hash must not depend on what order the filesystem
    happens to hand them back in - the same tree has to give the same string on
    a contributor's machine and on the runner.
    """
    return sorted(
        os.path.join(asset_dir, name)
        for name in os.listdir(asset_dir)
        if name.endswith((".js", ".css"))
    )


def version_of(paths: list[str]) -> str:
    """A short hash of the given files, name and contents both.

    The name is hashed as well as the bytes, so that renaming a module changes
    the version even when nothing inside it did - the browser is being asked
    for a different URL, and a page that asks for a different set of files is a
    different release.
    """
    digest = hashlib.sha256()
    for path in paths:
        digest.update(os.path.basename(path).encode("utf-8"))
        digest.update(b"\0")
        digest.update(open(path, "rb").read())
        digest.update(b"\0")
    return digest.hexdigest()[:LENGTH]


def main(argv: list[str]) -> int:
    check_only = "--check" in argv

    if not os.path.exists(PAGE):
        print(f"{PAGE} is missing", file=sys.stderr)
        return 1

    assets = versioned_assets()
    if not assets:
        print(f"no .js or .css under {ASSET_DIR}/ to version", file=sys.stderr)
        return 1

    wanted = version_of(assets)
    page = open(PAGE, encoding="utf-8", newline="").read()
    found = {match.group(2) for match in VERSION_RE.finditer(page)}

    if not found:
        print(f"{PAGE} carries no ?v= at all; nothing to write", file=sys.stderr)
        return 1

    if found == {wanted}:
        print(f"OK - {len(assets)} assets, version {wanted}, already current.")
        return 0

    if check_only:
        print(f"{PAGE} asks for {', '.join(sorted(found))}; the assets hash to {wanted}.",
              file=sys.stderr)
        print("Run: python tools/build_version.py", file=sys.stderr)
        return 1

    updated, count = VERSION_RE.subn(lambda m: m.group(1) + wanted, page)
    open(PAGE, "w", encoding="utf-8", newline="").write(updated)
    print(f"OK - {len(assets)} assets hash to {wanted}; wrote {count} slots in {PAGE}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
