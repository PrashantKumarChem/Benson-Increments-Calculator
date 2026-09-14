"""Tests for finding the source data and reading it into records.

Most of these rules have no JavaScript test to be ported from: the browser
never lists a folder, so until now they were exercised only through
tools/validate_data.py. Each test here was broken deliberately before it was
trusted.

The fixture files are written without a trailing newline, as the real ones are.

    python -m unittest discover -s benson/tests -t .
"""
import os
import tempfile
import unittest
from pathlib import Path

from benson.data import (
    CSV_DIR,
    NOTATION_DIR,
    OPTIONAL_COLUMNS,
    REFERENCES_PATH,
    Category,
    Reference,
    Row,
    find_categories,
    read_category,
    read_metadata,
    read_pairs,
    read_references,
    title_for,
    unresolved_sources,
)
from benson.values import read_value

ROOT = Path(__file__).resolve().parents[2]


class Fixture(unittest.TestCase):
    """A scratch folder per test, so no test can read another's files."""

    def setUp(self):
        self._folder = tempfile.TemporaryDirectory()
        self.folder = self._folder.name

    def tearDown(self):
        self._folder.cleanup()

    def write(self, name, text, encoding="utf-8"):
        path = os.path.join(self.folder, name)
        with open(path, "w", encoding=encoding, newline="") as handle:
            handle.write(text)
        return path


class CategoryFiles(unittest.TestCase):
    def test_a_filename_is_two_digits_an_underscore_then_the_name(self):
        for name in ["01_CH_Groups.csv", "05_Cyclohexane_A_Values.csv", "99_X.csv"]:
            with self.subTest(name=name):
                self.assertTrue(Category(path=name).has_valid_name, f"{name} follows the convention")
        for name in ["1_CH_Groups.csv", "01-CH_Groups.csv", "01_CH Groups.csv",
                     "01_CH_Groups.txt", "CH_Groups.csv"]:
            with self.subTest(name=name):
                self.assertFalse(Category(path=name).has_valid_name, f"{name} does not follow it")

    def test_the_title_is_the_filename_as_its_contributor_wrote_it(self):
        # No list of chemical acronyms: CH stays CH because it was written so.
        self.assertEqual(title_for("01_CH_Groups"), "CH Groups")
        self.assertEqual(title_for("03_CHNO_Groups"), "CHNO Groups")
        self.assertEqual(title_for("05_Cyclohexane_A_Values"), "Cyclohexane A Values")

    def test_a_name_outside_the_convention_is_still_given_a_title(self):
        self.assertEqual(title_for("stray_notes"), "stray notes")

    def test_a_category_knows_its_file_stem_and_title_from_its_path(self):
        category = Category(path=os.path.join("some", "folder", "03_CHNO_Groups.csv"))
        self.assertEqual(category.file, "03_CHNO_Groups.csv")
        self.assertEqual(category.stem, "03_CHNO_Groups")
        self.assertEqual(category.title, "CHNO Groups")


class ReadingACategory(Fixture):
    def test_reads_the_header_and_the_rows_trimmed(self):
        path = self.write("01_A.csv", "Group , Value\n C-(C)(H)3 , -42 \nC-(C)2(H)2,-20.9")
        category = read_category(path)
        self.assertEqual(category.columns, ["Group", "Value"])
        self.assertEqual(category.rows, [Row("C-(C)(H)3", "-42"), Row("C-(C)2(H)2", "-20.9")])

    def test_a_byte_order_mark_is_not_part_of_the_first_column(self):
        # Excel writes one when it saves as UTF-8, and a contributor has Excel.
        path = self.write("01_A.csv", "Group,Value\nC-(C)(H)3,-42", encoding="utf-8-sig")
        self.assertEqual(read_category(path).columns, ["Group", "Value"])

    def test_a_blank_line_is_not_a_row(self):
        # Nor a line to report: a malformed line is kept so the validator can
        # name it, and an empty line or one of spaces is not malformed.
        path = self.write("01_A.csv", "Group,Value\nC-(C)(H)3,-42\n\n   \nC-(C)2(H)2,-20.9")
        category = read_category(path)
        self.assertEqual([cells for _, cells in category.records], [("C-(C)(H)3", "-42"), ("C-(C)2(H)2", "-20.9")],
                         "a blank line, or one of spaces, is not kept")
        self.assertEqual(category.rows, [Row("C-(C)(H)3", "-42"), Row("C-(C)2(H)2", "-20.9")])

    def test_each_line_keeps_the_number_it_has_in_the_file(self):
        # The validator reports a fault by line. Counted from the rows alone,
        # every line after the first blank one was reported one too early, and
        # the site, which counts the file's own lines, named a different line.
        path = self.write("01_A.csv", "Group,Value\nC-(C)(H)3,-42\n\n   \nC-(C)2(H)2,-20.9")
        self.assertEqual(read_category(path).records,
                         [(2, ("C-(C)(H)3", "-42")), (5, ("C-(C)2(H)2", "-20.9"))],
                         "a line is numbered as it is in the file, blank lines counted")

    def test_a_quoted_cell_over_two_lines_does_not_move_the_lines_after_it(self):
        path = self.write("01_A.csv", 'Group,Value\n"C-(C)\n(H)3",-42\nC-(C)2(H)2,-20.9')
        self.assertEqual([line for line, _ in read_category(path).records], [2, 4],
                         "a line is numbered by where it starts in the file")

    def test_a_line_with_more_cells_than_the_header_has_columns_is_kept_whole_and_is_not_a_row(self):
        # D,5,0.03 used to be read as D with the value 5: the third cell was
        # dropped before anything could see it, so the validator's stray-comma
        # message could never fire. The site reads the same line as a group
        # called "D,5".
        path = self.write("01_A.csv", "Group,Value\nD,5,0.03\nC-(C)(H)3,-42")
        category = read_category(path)
        self.assertEqual(category.records, [(2, ("D", "5", "0.03")), (3, ("C-(C)(H)3", "-42"))],
                         "every cell of the line is kept, so the validator can count them")
        self.assertEqual(category.rows, [Row("C-(C)(H)3", "-42")],
                         "a line of three cells under a two-column header is not a group and a value")

    def test_a_line_with_no_group_name_is_kept_and_is_not_a_row(self):
        # It used to be dropped, so the validator's "missing group name" could
        # never fire either; the site reports this line by that name.
        path = self.write("01_A.csv", "Group,Value\n,0.03\nC-(C)(H)3,-42")
        category = read_category(path)
        self.assertEqual(category.records, [(2, ("", "0.03")), (3, ("C-(C)(H)3", "-42"))],
                         "a line with a value and no name is kept")
        self.assertEqual(category.rows, [Row("C-(C)(H)3", "-42")],
                         "a value without a name is not a row")

    def test_a_line_with_one_cell_is_kept_and_is_not_a_row(self):
        path = self.write("01_A.csv", "Group,Value\nC-(C)(H)3 -42")
        category = read_category(path)
        self.assertEqual(category.records, [(2, ("C-(C)(H)3 -42",))], "a line with no comma is kept")
        self.assertEqual(category.rows, [], "and is not a row")

    def test_a_quoted_group_name_may_hold_a_comma(self):
        path = self.write("01_A.csv", 'Group,Value\n"Ct-(CB), CB-(Ct)",25')
        self.assertEqual(read_category(path).rows, [Row("Ct-(CB), CB-(Ct)", "25")])

    def test_an_empty_file_has_no_columns_and_no_rows(self):
        # The validator reports an empty file by name, which it cannot do if
        # reading one raises first.
        try:
            category = read_category(self.write("01_A.csv", ""))
        except Exception as error:
            self.fail(f"an empty file has to read as empty, not raise: {error!r}")
        self.assertEqual(category.columns, [])
        self.assertEqual(category.records, [])
        self.assertEqual(category.rows, [])


class ReadingPairs(Fixture):
    def test_the_value_is_after_the_last_comma_so_a_name_may_hold_one(self):
        path = self.write("pairs.csv", "Key,Value\nCt-(CB), CB-(Ct),C2")
        self.assertEqual(list(read_pairs(path)), [(2, "Ct-(CB), CB-(Ct)", "C2")])

    def test_line_numbers_count_the_header_and_any_blank_lines(self):
        path = self.write("pairs.csv", "Key,Value\nC,C\n\nO,O")
        self.assertEqual([line for line, _, _ in read_pairs(path)], [2, 4])

    def test_a_quoted_key_is_unquoted(self):
        path = self.write("pairs.csv", 'Key,Value\n"Cis- (one t-butyl)",none')
        self.assertEqual(list(read_pairs(path)), [(2, "Cis- (one t-butyl)", "none")])

    def test_one_quote_comes_off_each_end_of_a_key_and_no_more(self):
        # As the site reads a notation file, so that both look up the same name.
        path = self.write("pairs.csv", 'Key,Value\n""Cis- (one t-butyl)"",none')
        self.assertEqual(list(read_pairs(path)), [(2, '"Cis- (one t-butyl)"', "none")],
                         "a doubled quote keeps one, as the site keeps it")

    def test_a_line_with_no_comma_is_a_key_with_no_value(self):
        # Reported by the validator as a key with no value, rather than skipped.
        path = self.write("pairs.csv", "Key,Value\n just a name ")
        self.assertEqual(list(read_pairs(path)), [(2, "just a name", "")])


class CategoryMetadata(Fixture):
    def test_keyed_by_file_with_every_field_present(self):
        self.write("categories.csv",
                   "File,Quantity,Symbol,Unit,Source,Note,Annotation\n"
                   "01_A.csv,standard enthalpy of formation,ΔHf°,kJ/mol,A source,"
                   "\"a note, with a comma\",ignored\n"
                   "02_B.csv,,,,,\n"
                   ",an orphan row,,,,")
        self.assertEqual(read_metadata(self.folder), {
            "01_A.csv": {
                "quantity": "standard enthalpy of formation",
                "symbol": "ΔHf°",
                "unit": "kJ/mol",
                "source": "A source",
                "note": "a note, with a comma",
            },
            "02_B.csv": {"quantity": "", "symbol": "", "unit": "", "source": "", "note": ""},
        })

    def test_a_column_left_out_reads_as_blank(self):
        self.write("categories.csv", "File,Quantity\n01_A.csv,conformational preference")
        self.assertEqual(read_metadata(self.folder)["01_A.csv"],
                         {"quantity": "conformational preference",
                          "symbol": "", "unit": "", "source": "", "note": ""})

    def test_no_metadata_file_means_no_metadata(self):
        self.assertEqual(read_metadata(self.folder), {})


class OptionalColumns(Fixture):
    """D9: a group name and a value are required; every other column is optional,
    and found by its title."""

    HEADER = ",".join(("Group", "Value") + OPTIONAL_COLUMNS)

    def test_a_two_column_file_reads_every_optional_field_as_blank(self):
        path = self.write("01_A.csv", "CH Benson Group Increment,Delta_Hf kJ/mol\nC-(C)(H)3,-42")
        self.assertEqual(read_category(path).rows,
                         [Row("C-(C)(H)3", "-42", unit="", uncertainty="", source="", verified="", note="")])

    def test_every_optional_column_is_read_into_its_own_field(self):
        path = self.write("01_A.csv", f"{self.HEADER}\nC-(C)(H)3,-10.00,kcal/mol,0.1,REF1,2000-01-01;AB;p1,a note")
        self.assertEqual(read_category(path).rows,
                         [Row("C-(C)(H)3", "-10.00", unit="kcal/mol", uncertainty="0.1", source="REF1",
                              verified="2000-01-01;AB;p1", note="a note")])

    def test_optional_columns_are_found_by_title_in_any_order(self):
        path = self.write("01_A.csv", "Group,Value,Source,Unit\nC-(C)(H)3,-10.00,REF1,kcal/mol")
        self.assertEqual(read_category(path).rows, [Row("C-(C)(H)3", "-10.00", unit="kcal/mol", source="REF1")])

    def test_a_row_may_stop_before_its_trailing_optional_cells(self):
        # The shape a hand-edited file takes: a Unit on the one row that needs
        # it, and the rows above left exactly as they were.
        path = self.write("01_A.csv", f"{self.HEADER}\nC-(C)(H)3,-42\nC-(C)2(H)2,-5.00,kcal/mol")
        self.assertEqual(read_category(path).rows,
                         [Row("C-(C)(H)3", "-42"), Row("C-(C)2(H)2", "-5.00", unit="kcal/mol")])

    def test_a_line_wider_than_a_wide_header_is_kept_and_is_not_a_row(self):
        path = self.write("01_A.csv", "Group,Value,Note\nC-(C)(H)3,-42,a note,stray\nC-(C)2(H)2,-20.9,fine")
        category = read_category(path)
        self.assertEqual(len(category.records), 2, "the wide line is kept, so the validator can report it")
        self.assertEqual(category.rows, [Row("C-(C)2(H)2", "-20.9", note="fine")])

    def test_the_first_two_columns_are_the_group_and_value_whatever_their_titles(self):
        # Found by position, which every file already written relies on - so a
        # title an optional column also uses does not move the value.
        path = self.write("01_A.csv", "Source,Unit\nC-(C)(H)3,-42")
        self.assertEqual(read_category(path).rows, [Row("C-(C)(H)3", "-42")])

    def test_a_column_that_is_not_an_optional_one_is_not_read_into_any_field(self):
        # Reading does not judge - tools/validate_data.py refuses this header by
        # name - but it does not guess either: 'Sources' is not 'Source'.
        path = self.write("01_A.csv", "Group,Value,Sources\nC-(C)(H)3,-42,REF1")
        self.assertEqual(read_category(path).rows, [Row("C-(C)(H)3", "-42")])

    def test_each_row_keeps_the_line_it_starts_on(self):
        path = self.write("01_A.csv", "Group,Value,Note\nC-(C)(H)3,-42\n\n,no name\nC-(C)2(H)2,-20.9,x")
        self.assertEqual(read_category(path).numbered_rows,
                         [(2, Row("C-(C)(H)3", "-42")), (5, Row("C-(C)2(H)2", "-20.9", note="x"))])


class ReadingReferences(Fixture):
    def references(self):
        return read_references(os.path.join(self.folder, "references.csv"))

    def test_every_reference_in_file_order_with_the_line_it_is_on(self):
        # Order is the numbering, so it is pinned with keys that do not sort
        # into it.
        self.write("references.csv",
                   'Key,Citation,DOI\nZED,"Zed, A. A work, 2000.",10.0000/zed\nABE,"Abe, B. Another, 1999.",')
        self.assertEqual(self.references(), [
            Reference(2, "ZED", "Zed, A. A work, 2000.", "10.0000/zed"),
            Reference(3, "ABE", "Abe, B. Another, 1999.", ""),
        ])

    def test_columns_are_found_by_title(self):
        self.write("references.csv", "DOI,Key,Citation\n,REF1,A citation")
        self.assertEqual(self.references(), [Reference(2, "REF1", "A citation", "")])

    def test_a_line_without_a_key_is_not_a_reference(self):
        self.write("references.csv", "Key,Citation,DOI\n,An orphan citation,\nREF1,A citation,")
        self.assertEqual([reference.key for reference in self.references()], ["REF1"])

    def test_a_header_and_no_rows_is_no_references(self):
        self.write("references.csv", "Key,Citation,DOI")
        self.assertEqual(self.references(), [])

    def test_no_references_file_is_no_references(self):
        self.assertEqual(self.references(), [])


class ResolvingSources(Fixture):
    REF1 = Reference(2, "REF1", "A citation", "")

    def test_a_source_that_names_no_reference_is_unresolved(self):
        category = read_category(self.write("01_A.csv", "Group,Value,Source\nC-(C)(H)3,-42,REF1\nC-(C)2(H)2,-20.9,NOPE"))
        self.assertEqual(unresolved_sources([category], [self.REF1]),
                         [("01_A.csv", 3, Row("C-(C)2(H)2", "-20.9", source="NOPE"))])

    def test_a_blank_source_is_not_unresolved(self):
        category = read_category(self.write("01_A.csv", "Group,Value,Source\nC-(C)(H)3,-42,\nC-(C)2(H)2,-20.9"))
        self.assertEqual(unresolved_sources([category], []), [])

    def test_a_key_is_matched_exactly(self):
        # A key is an identifier, not a name to be forgiving about.
        category = read_category(self.write("01_A.csv", "Group,Value,Source\nC-(C)(H)3,-42,ref1"))
        self.assertEqual(len(unresolved_sources([category], [self.REF1])), 1)

    def test_every_source_in_the_served_files_names_a_reference(self):
        categories = find_categories(str(ROOT / CSV_DIR))
        self.assertEqual(unresolved_sources(categories, read_references(str(ROOT / REFERENCES_PATH))), [])


class FindingCategories(Fixture):
    def test_every_csv_in_the_folder_in_filename_order(self):
        # Mixed case on purpose: a filesystem that lists a folder alphabetically
        # ignoring case would otherwise pass for sorted, and the runner's does
        # not list it that way at all.
        for name in ["10_J.csv", "02_B.csv", "stray.csv", "01_A.csv", "Zeta.csv"]:
            self.write(name, "Group,Value\nC,1")
        self.write("readme.txt", "not a category")
        self.assertEqual([category.file for category in find_categories(self.folder)],
                         ["01_A.csv", "02_B.csv", "10_J.csv", "Zeta.csv", "stray.csv"])

    def test_a_category_comes_back_read(self):
        self.write("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        [category] = find_categories(self.folder)
        self.assertEqual(category.rows, [Row("C-(C)(H)3", "-42")])


class TheRepositoryData(unittest.TestCase):
    """The rules above, run over the files the site actually serves."""

    @classmethod
    def setUpClass(cls):
        cls.categories = find_categories(str(ROOT / CSV_DIR))

    def row(self, file, label):
        category = next((c for c in self.categories if c.file == file), None)
        self.assertIsNotNone(category, f"no category file {file} in {CSV_DIR}/")
        rows = {row.group: row.value for row in category.rows}
        self.assertIn(label, rows, f"no increment {label!r} in {file}")
        return read_value(rows[label])

    def test_every_line_of_every_file_is_read_as_a_row(self):
        # What a row is was exactly what widening the schema changed. A line the
        # reader stopped recognising would fail nothing downstream - it would
        # simply not be there - so every line of the served files is held to
        # being one.
        for category in self.categories:
            with self.subTest(file=category.file):
                self.assertEqual(len(category.rows), len(category.records))

    def test_the_package_finds_every_category_file(self):
        # Pinned by name, not by counting the package's own glob against
        # itself: find_categories() *is* that glob, so comparing its length to
        # a second glob('*.csv') can never fail. This is the independent check
        # that manifest.json used to be - a category silently dropped, renamed
        # or added without updating this list should fail here.
        self.assertEqual([c.file for c in self.categories], [
            "01_CH_Groups.csv",
            "02_CHO_Groups.csv",
            "03_CHNO_Groups.csv",
            "04_Corrections.csv",
            "05_Cyclohexane_A_Values.csv",
        ])
        self.assertTrue(read_metadata(str(ROOT / NOTATION_DIR)), "notation/categories.csv did not load")

    def test_every_increment_reads_with_a_source_and_a_precision(self):
        for category in self.categories:
            for row in category.rows:
                with self.subTest(file=category.file, label=row.group):
                    reading = read_value(row.value)
                    self.assertIsInstance(reading.source, str)
                    self.assertIsInstance(reading.decimals, int)

    def test_a_published_range_is_averaged_and_keeps_its_bounds(self):
        self.assertEqual(self.row("05_Cyclohexane_A_Values.csv", "F").value, (1.05 + 1.76) / 2)
        oh = self.row("05_Cyclohexane_A_Values.csv", "OH")
        self.assertTrue(oh.is_range)
        self.assertEqual((oh.low, oh.high), (2.51, 4.35))


if __name__ == "__main__":
    unittest.main()
