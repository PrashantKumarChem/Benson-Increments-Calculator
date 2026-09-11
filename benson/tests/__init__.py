"""Tests for the rules in this package.

The porting order is test first: write the Python test from the JavaScript test
that covers the rule today, watch it fail, then move the rule. A rule that
arrives without a failing test first cannot be shown to have arrived intact.

Standard library only, so nothing is installed to run them. From the repository
root:

    python -m unittest discover -s benson/tests -t .
"""
