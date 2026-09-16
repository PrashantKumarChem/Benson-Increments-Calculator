"""Reading a written value: what the number is, and how the source wrote it.

A cell is a number, `-42` or `13.8`, or a published range, `1.05 to 1.76`,
which is averaged. A bare hyphen is not a range separator, because it also
starts a negative number. Anything else is refused, loudly.

The value is in whatever unit its category declares. Nothing here converts.

This is the only place the rule is written. `assets/benson.js` used to carry
its own copy for the browser; it now only renders `benson.build`'s generated
artifact, and the notebook imports this module directly.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# re.ASCII: \d would otherwise match any Unicode decimal digit (Arabic-Indic,
# fullwidth, ...), which float() also happily accepts - so a cell written in
# one of those would be read as a number rather than refused, silently
# carrying a non-ASCII character into `source` for the rest of the pipeline
# to trip on. Every regex in this module that reads a value shares this.
NUMBER_RE = re.compile(r"^-?\d*\.?\d+$", re.ASCII)
# "1.05 to 1.76" is a published range and is averaged. The separator is a word
# rather than a hyphen because a hyphen also starts a negative number: reading
# "-42" needs to know that its dash is a sign, and every implementation that
# has to work that out is one that can work it out differently. "to" cannot be
# a sign, so the two forms stop overlapping and the rule stops needing care.
# The spaces around it must be ASCII ones: re.ASCII narrows \s as well as \d,
# so a non-breaking space pasted out of a PDF table is refused rather than read
# as a separator - and the hyphen form below is narrowed the same way. Stricter
# than before re.ASCII, and deliberate.
RANGE_RE = re.compile(r"^(-?\d*\.?\d+)\s+to\s+(-?\d*\.?\d+)$", re.ASCII)
# The form this replaced. Matched only so it can be refused by name: falling
# through to "neither a number nor a range" would tell a contributor their row
# is unreadable without telling them it used to be the house style.
HYPHEN_RANGE_RE = re.compile(r"^(-?\d*\.?\d+)\s*-\s*(-?\d*\.?\d+)$", re.ASCII)
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


def read_uncertainty(raw) -> Optional[float]:
    """A row's Uncertainty cell: the ± its source prints, or None where it prints none.

    One number, unsigned. A ± is a magnitude, so a sign is a mistake rather
    than information; and the range form a value may take would read
    "0.1 to 0.3" as its average, an uncertainty nobody printed.
    """
    text = cell_text(raw)
    if not text:
        return None
    if NUMBER_RE.match(text) and not text.startswith("-"):
        return float(text)
    raise InvalidValueError(f"uncertainty {text!r} is not an unsigned number - write the figure alone, like '0.5'")


#: 1 thermochemical calorie = 4.184 J, exactly (D18). Converts a value as its
#: source prints it into the kJ/mol the site sums. Every category declares
#: kJ/mol today, so nothing actually converts yet - the rule lives here so the
#: day a category is re-entered in kcal/mol, the build has it in one place
#: rather than reinventing it.
KCAL_TO_KJ = 4.184

#: For showing the running total in kcal/mol beside kJ/mol. Not KCAL_TO_KJ's
#: reciprocal (1 / 4.184 = 0.23900574...): this is assets/benson.js's own
#: constant, copied verbatim so a displayed kcal total keeps reading exactly as
#: it always has. The two factors serve different purposes and both belong.
KJ_TO_KCAL_DISPLAY = 0.239006


def to_kj(value: Optional[float], unit: str) -> Optional[float]:
    """A value, in the unit its category declares, converted to kJ/mol.

    None passes through unchanged - a Value only has low/high when it is a
    range. Every category declares kJ/mol today (D18), so this is the identity
    for all of them; it exists so the conversion has a home before it is needed.
    """
    if value is None:
        return None
    unit = (unit or "kJ/mol").strip()
    if unit == "kJ/mol":
        return value
    if unit == "kcal/mol":
        return value * KCAL_TO_KJ
    raise ValueError(f"{unit!r} is not a unit this package can convert - only 'kJ/mol' and 'kcal/mol'")
