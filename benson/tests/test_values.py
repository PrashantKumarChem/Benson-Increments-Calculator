"""Tests for reading a written value.

Ported from the JavaScript tests that hold the same rule in the browser: the
parseValue cases in tools/selection.test.mjs, and the precision and bounds that
tools/format.test.mjs and tools/browse.test.mjs rely on readValue to carry.
Those stay, and keep testing assets/benson.js, until the website stops parsing.

    python -m unittest discover -s benson/tests -t .
"""
import unittest

from benson.values import InvalidValueError, is_range, parse_value, read_value


class PlainNumbers(unittest.TestCase):
    def test_reads_plain_numbers_including_negatives(self):
        self.assertEqual(parse_value("-42"), -42)
        self.assertEqual(parse_value("-20.9"), -20.9)
        self.assertEqual(parse_value("2"), 2)
        self.assertEqual(parse_value(" 3.4 "), 3.4)

    def test_a_quoted_cell_reads_as_what_it_quotes(self):
        self.assertEqual(parse_value('"-42"'), -42)

    def test_rejects_anything_that_is_not_a_number_or_a_range(self):
        for bad in ["", "   ", "abc", "1.2.3", "--4"]:
            with self.subTest(bad=bad):
                with self.assertRaises(InvalidValueError):
                    parse_value(bad)

    def test_a_rejection_is_still_a_value_error(self):
        # validate_data.py catches ValueError, not this package's own class, so
        # a bad row is reported rather than crashing the run that reports it.
        self.assertTrue(issubclass(InvalidValueError, ValueError),
                        "a refusal that is not a ValueError escapes the validator's report")


class Ranges(unittest.TestCase):
    def test_averages_a_published_range(self):
        self.assertEqual(parse_value("1.05 to 1.76"), (1.05 + 1.76) / 2)
        self.assertEqual(parse_value("19.66 to 20.50"), (19.66 + 20.5) / 2)

    def test_a_range_written_with_a_hyphen_is_refused_and_says_what_to_write(self):
        # The form this data used to be written in. It is refused rather than
        # read, because reading it means deciding whether the dash in '-42' is a
        # sign. The message has to name the old form: falling through to
        # 'neither a number nor a range' would leave a contributor with a row
        # that is unreadable for no stated reason.
        with self.assertRaises(InvalidValueError) as caught:
            parse_value("1.05-1.76")
        self.assertIn("hyphen", str(caught.exception),
                      "the message has to name what is wrong with the row")
        self.assertIn("'1.05 to 1.76'", str(caught.exception),
                      "and quote the row rewritten correctly")

    def test_refusing_the_hyphen_form_does_not_refuse_a_negative_number(self):
        # The refusal and the minus sign are the same character. If the refusal
        # ever widened to cover a leading minus, most of the data would stop
        # loading - so the two are pinned together.
        self.assertEqual(parse_value("-42"), -42)
        self.assertEqual(parse_value("-20.9"), -20.9)

    def test_a_range_is_recognised_as_one(self):
        # validate_data.py keeps ranges and negative values in separate files by
        # asking this. Were it to answer False for everything, that rule would
        # stop firing with every check still green.
        for text in ["1.05 to 1.76", ' "2.51 to 4.35" ', "-5.2 to -3.1"]:
            with self.subTest(text=text):
                self.assertTrue(is_range(text), f"{text!r} is a published range")

    def test_a_number_or_the_hyphen_form_is_not_a_range(self):
        for text in ["-42", "13.8", "1.05-1.76"]:
            with self.subTest(text=text):
                self.assertFalse(is_range(text), f"{text!r} is not a range")


class HowTheSourceWroteIt(unittest.TestCase):
    """The precision and bounds a page needs to show a value honestly.

    The arithmetic uses only the value. These fields exist so that -42 is not
    shown as -42.00, and so that 3.43 can be shown as the middle of 2.51 to 4.35
    rather than as a published figure.
    """

    def test_a_whole_number_claims_no_decimals(self):
        self.assertEqual(read_value("-42").decimals, 0)
        self.assertEqual(read_value("118").decimals, 0)

    def test_a_number_claims_the_decimals_it_is_written_with(self):
        self.assertEqual(read_value("-20.9").decimals, 1)
        self.assertEqual(read_value("13.8").decimals, 1)
        self.assertEqual(read_value("0.03").decimals, 2)

    def test_the_source_is_the_cell_as_written(self):
        reading = read_value(" -20.9 ")
        self.assertEqual(reading.source, "-20.9")
        self.assertEqual(reading.value, -20.9)

    def test_a_plain_number_has_no_bounds(self):
        reading = read_value("-42")
        self.assertFalse(reading.is_range)
        self.assertIsNone(reading.low)
        self.assertIsNone(reading.high)

    def test_a_range_keeps_the_bounds_it_was_averaged_from(self):
        reading = read_value("2.51 to 4.35")
        self.assertTrue(reading.is_range)
        self.assertEqual(reading.low, 2.51)
        self.assertEqual(reading.high, 4.35)
        self.assertEqual(reading.value, (2.51 + 4.35) / 2)
        self.assertEqual(reading.source, "2.51 to 4.35")

    def test_a_range_claims_the_precision_of_its_more_precise_bound(self):
        self.assertEqual(read_value("1.5 to 2.25").decimals, 2)
        self.assertEqual(read_value("2.25 to 3.5").decimals, 2)

    def test_parse_value_is_the_value_read_value_reads(self):
        for text in ["-42", "0.03", "1.05 to 1.76"]:
            with self.subTest(text=text):
                self.assertEqual(parse_value(text), read_value(text).value)


if __name__ == "__main__":
    unittest.main()
