"""Reading a written value: what the number is, and how the source wrote it.

A cell is a number, `-42` or `13.8`, or a published range, `1.05 to 1.76`,
which is averaged. A bare hyphen is not a range separator, because it also
starts a negative number. Anything else is refused, loudly.

The value is in whatever unit its category declares. Nothing here converts.

`assets/benson.js` applies the same rule in the browser until the website reads
a generated artifact instead of parsing, and `tools/check_parity.mjs` holds that
copy to the notebook's own reading in the meantime.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

NUMBER_RE = re.compile(r"^-?\d*\.?\d+$")
# "1.05 to 1.76" is a published range and is averaged. The separator is a word
# rather than a hyphen because a hyphen also starts a negative number: reading
# "-42" needs to know that its dash is a sign, and every implementation that
# has to work that out is one that can work it out differently. "to" cannot be
# a sign, so the two forms stop overlapping and the rule stops needing care.
RANGE_RE = re.compile(r"^(-?\d*\.?\d+)\s+to\s+(-?\d*\.?\d+)$")
# The form this replaced. Matched only so it can be refused by name: falling
# through to "neither a number nor a range" would tell a contributor their row
# is unreadable without telling them it used to be the house style.
HYPHEN_RANGE_RE = re.compile(r"^(-?\d*\.?\d+)\s*-\s*(-?\d*\.?\d+)$")
# A spreadsheet may quote a cell. One quote comes off each end and no more, which
# is how the site reads a cell: taking every quote off would accept '""-42""'
# here while the site refuses it.
QUOTE_PAIR_RE = re.compile(r'\A"|"\Z')


class InvalidValueError(ValueError):
    """A cell that is neither a number nor a range."""


@dataclass(frozen=True)
class Value:
    """One cell read: the number the arithmetic uses, and how the source wrote it.

    Only `value` is ever summed. The rest exist so a page can show `-42` rather
    than `-42.00`, and can say that 3.43 is the middle of 2.51 to 4.35 rather
    than present it as a published figure.
    """

    value: float
    #: The cell as written, trimmed.
    source: str
    #: Decimal places the source claims; a range claims its more precise bound's.
    decimals: int
    is_range: bool
    low: Optional[float] = None
    high: Optional[float] = None


def cell_text(raw) -> str:
    """A cell as written: the space around it trimmed, then one quote off each end."""
    return QUOTE_PAIR_RE.sub("", str(raw).strip())


def _decimals_of(text: str) -> int:
    """How many decimal places a written number claims. "-42" claims none."""
    return len(text.split(".")[1]) if "." in text else 0


def read_value(raw) -> Value:
    """Read one cell. Ranges are averaged; negatives are preserved."""
    text = cell_text(raw)
    if not text:
        raise InvalidValueError("empty value")
    match = RANGE_RE.match(text)
    if match:
        low, high = float(match.group(1)), float(match.group(2))
        return Value(
            value=(low + high) / 2,
            source=text,
            decimals=max(_decimals_of(match.group(1)), _decimals_of(match.group(2))),
            is_range=True,
            low=low,
            high=high,
        )
    if NUMBER_RE.match(text):
        return Value(value=float(text), source=text, decimals=_decimals_of(text), is_range=False)
    hyphenated = HYPHEN_RANGE_RE.match(text)
    if hyphenated:
        raise InvalidValueError(
            f"{text!r} writes a range with a hyphen, which also starts a negative "
            f"number. Write it as '{hyphenated.group(1)} to {hyphenated.group(2)}'."
        )
    raise InvalidValueError(f"{text!r} is neither a number nor a range like '1.05 to 1.76'")


def parse_value(raw) -> float:
    """The number a cell holds.

    Defined through read_value so there is one reading of a cell rather than two
    that can drift apart.
    """
    return read_value(raw).value
