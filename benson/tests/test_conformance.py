"""The contract both implementations are held to.

tests/conformance.json pins input -> expected-output cases for the handful of
rules that a generated artifact cannot remove drift from: the tally
arithmetic, how a total is formatted, how a query is matched, and whether an
uncertainty propagates (D7 layer C, WP4). This file is the Python side of that
contract; tools/conformance.test.mjs is the other.

'query' is checked against benson.notation's own normalise()/score_of() - the
functions this package already uses to precompute each increment's aliases at
build time - so a change to either one that breaks the pinned contract fails
here, not just in a reimplementation written for the test.

'tally', 'total' and 'uncertainty' have no Python production consumer yet: the
notebook has no widget UI before WP5+ (see Plan/01-architecture.md's "Notebook
UI scope"), and this package's WP4 territory does not extend benson/ to cover
them - see the WP4 pull request. The small pure functions below pin those
three rules ahead of that consumer, mirroring assets/selection.js's totalKj,
assets/format.js's formatTotal and combinedUncertainty(). Whoever builds the
notebook UI should replace these with an import from wherever that widget
logic ends up, not reinvent the rule.

    python -m unittest discover -s benson/tests -t .
"""
import json
import unittest
from pathlib import Path

from benson.notation import Match, normalise, score_of

ROOT = Path(__file__).resolve().parents[2]

with open(ROOT / "tests" / "conformance.json", encoding="utf-8") as handle:
    FIXTURE = json.load(handle)

SCORE_LABEL = {Match.EXACT: "exact", Match.PREFIX: "prefix", Match.CONTAINS: "contains"}


def tally(entries) -> float:
    """sum(value x count) - the running total's whole arithmetic."""
    return sum(entry["value"] * entry["count"] for entry in entries)


def format_total(kj: float) -> str:
    """One decimal place, a typographic minus, and zero takes no sign.

    Mirrors assets/format.js's formatTotal/withSign; kept in the test rather
    than the package because nothing in benson/ renders a total yet.
    """
    text = f"{abs(kj):.1f}"
    if kj > 0:
        return f"+{text}"
    if kj < 0:
        return f"−{text}"
    return text


def combined_uncertainty(individual_uncertainties, method_figure: float) -> float:
    """The whole-method figure, never a quadrature sum of the individuals.

    `individual_uncertainties` is accepted and deliberately not summed - see
    D11 and assets/format.js's combinedUncertainty(), which this mirrors.
    """
    return method_figure


def query(input_):
    """The best score a query gets among the given (already-normalised) aliases."""
    aliases = [normalise(alias) for alias in input_["aliases"]]
    score = score_of(input_["query"], aliases)
    return None if score is None else SCORE_LABEL[score]


RULES = {
    "tally": lambda input_: tally(input_["entries"]),
    "total": lambda input_: format_total(input_["kj"]),
    "query": query,
    "uncertainty": lambda input_: combined_uncertainty(
        input_["individualUncertainties"], input_["methodFigure"]),
}


class TheFixtureItself(unittest.TestCase):
    """Fail closed: a case this file cannot run must stop the run, not pass
    silently. A rule with no case pins nothing, which is the failure this
    fixture exists to prevent (D7 layer C)."""

    def test_every_case_names_a_rule_this_file_knows(self):
        unknown = {kase["rule"] for kase in FIXTURE["cases"]} - set(RULES)
        self.assertFalse(unknown, f"tests/conformance.json names unknown rule(s): {unknown}")

    def test_there_is_at_least_one_case(self):
        self.assertGreater(len(FIXTURE["cases"]), 0, "tests/conformance.json has no cases")

    def test_every_rule_is_exercised_at_least_once(self):
        covered = {kase["rule"] for kase in FIXTURE["cases"]}
        self.assertEqual(covered, set(RULES), "a rule this file can check has no fixture case")


class TheContract(unittest.TestCase):
    """One test per fixture case, so a failure names which contract broke."""


def _make_case_test(kase):
    def test(self):
        actual = RULES[kase["rule"]](kase["input"])
        self.assertEqual(actual, kase["expect"], kase["why"])
    return test


for _kase in FIXTURE["cases"]:
    setattr(TheContract, f"test_{_kase['id'].replace('-', '_')}", _make_case_test(_kase))


if __name__ == "__main__":
    unittest.main()
