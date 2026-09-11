"""Tests for what a group name means.

Only the composition syntax lives in the package so far: the rule the validator
applies to the notation files. The rest of assets/notation.js - decomposition,
formulae, search keys - is ported with its tests in a later change.

    python -m unittest discover -s benson/tests -t .
"""
import unittest

from benson.notation import COMPOSITION_RE


class CompositionSyntax(unittest.TestCase):
    def test_element_symbols_with_optional_counts_are_a_composition(self):
        for text in ["C", "N O2", "C2", "Cl", "C  H2"]:
            with self.subTest(text=text):
                self.assertIsNotNone(COMPOSITION_RE.match(text), f"{text!r} is a composition")

    def test_anything_else_is_not(self):
        # 'none' and 'unknown' are answered before this is asked, by name.
        for text in ["carbon", "", "c", "2C", " C", "C ", "N,O2", "CO2x", "none"]:
            with self.subTest(text=text):
                self.assertIsNone(COMPOSITION_RE.match(text), f"{text!r} is not a composition")


if __name__ == "__main__":
    unittest.main()
