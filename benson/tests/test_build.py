"""Tests for benson/build.py, which emits dist/increments.json.

tools/artifact.test.mjs holds the load-bearing proof - that the artifact holds
exactly what the site reads today - because that comparison needs the live
JavaScript readers. What belongs here is what does not: the guard against a
notation problem shipping silently (L16), and D18's unit conversion, which
needs a kcal/mol category nothing in the real data has yet.

    python -m unittest discover -s benson/tests -t .
"""
import json
import os
import tempfile
import unittest
from pathlib import Path

from benson.build import ARTIFACT_PATH, BuildError, build_artifact, write_artifact
from benson.data import CSV_DIR, NOTATION_DIR

ROOT = Path(__file__).resolve().parents[2]

# The four files load_notation() needs before it will read any group at all.
# Empty tables are a valid answer - see benson/notation.py - so a fixture that
# skips a file gets treated as "this notation says nothing", not as a broken one.
MINIMAL_NOTATION = {
    "central_atoms.csv": "Central notation,Atoms contributed\nC,C\n",
    "ligand_atoms.csv": "Ligand,Atoms contributed\nH,H\n",
    "special_labels.csv": "Group name,Composition\n",
    "synonyms.csv": "Group name,Also called\n",
}


class Fixture(unittest.TestCase):
    """A scratch CSV_DIR and a scratch NOTATION_DIR, so no test touches the real data."""

    def setUp(self):
        self._csv = tempfile.TemporaryDirectory()
        self._notation = tempfile.TemporaryDirectory()
        self.csv_dir = self._csv.name
        self.notation_dir = self._notation.name
        for name, text in MINIMAL_NOTATION.items():
            self._write(self.notation_dir, name, text)

    def tearDown(self):
        self._csv.cleanup()
        self._notation.cleanup()

    @staticmethod
    def _write(folder, name, text):
        with open(os.path.join(folder, name), "w", encoding="utf-8", newline="") as handle:
            handle.write(text)

    def write_csv(self, name, text):
        self._write(self.csv_dir, name, text)

    def write_notation(self, name, text):
        self._write(self.notation_dir, name, text)

    def build(self):
        return build_artifact(self.csv_dir, self.notation_dir)


class TheShapeOfTheArtifact(Fixture):
    def test_schema_and_content_hash_are_present(self):
        self.write_csv("01_A.csv", "Group,Value\nC-(H)4,-75")
        artifact = self.build()
        self.assertEqual(artifact["schema"], 1)
        self.assertIsInstance(artifact["content_hash"], str)
        self.assertTrue(artifact["content_hash"], "a content hash is not blank")

    def test_one_category_and_one_increment(self):
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        artifact = self.build()
        self.assertEqual([c["file"] for c in artifact["categories"]], ["01_A.csv"])
        self.assertEqual(artifact["categories"][0]["count"], 1)
        [increment] = artifact["increments"]
        self.assertEqual(increment["label"], "C-(C)(H)3")
        self.assertEqual(increment["category"], "01_A.csv")
        self.assertEqual(increment["value"], -42)
        self.assertEqual(increment["decimals"], 0)
        self.assertFalse(increment["isRange"])
        self.assertIsNone(increment["low"])
        self.assertIsNone(increment["high"])
        self.assertEqual(increment["kind"], "group")
        self.assertEqual(increment["composition"], {"C": 1, "H": 3})

    def test_a_category_with_no_metadata_row_still_builds_and_defaults_to_kj_mol(self):
        # notation/categories.csv is optional (H2) - a category nobody has
        # described yet must still build, with an unlabelled quantity/symbol
        # rather than a guess, and a unit the build can still convert by.
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        artifact = self.build()
        self.assertEqual(artifact["categories"][0]["quantity"], "")
        self.assertEqual(artifact["categories"][0]["unit"], "kJ/mol")

    def test_a_range_carries_its_bounds_and_the_text_as_printed(self):
        self.write_csv("05_A.csv", "Substituent,Value\nF,1.05 to 1.76")
        [increment] = self.build()["increments"]
        self.assertTrue(increment["isRange"])
        self.assertEqual((increment["low"], increment["high"]), (1.05, 1.76))
        self.assertEqual(increment["source"], "1.05 to 1.76")
        self.assertEqual(increment["value"], (1.05 + 1.76) / 2)

    def test_an_unreadable_named_group_carries_the_reason_and_no_composition(self):
        # The four [COd] rows on main are exactly this: a chemist's call to
        # leave a composition open, not a data fault (.claude/rules/data.md).
        self.write_csv("01_A.csv", "Group,Value\n[COd]-Cd(H)2,-78")
        self.write_notation("special_labels.csv", "Group name,Composition\n[COd]-Cd(H)2,unknown\n")
        [increment] = self.build()["increments"]
        self.assertEqual(increment["kind"], "unreadable")
        self.assertIsNone(increment["composition"])
        self.assertIsNotNone(increment["reason"])


class TheGuardAgainstAnUnreadableNotation(Fixture):
    """L16: the site used to step over a bad notation/ row in silence. Once the
    artifact is the only reading, that silence would ship a wrong composition
    to every consumer, so the build refuses instead - loudly, naming the row.
    """

    def test_a_missing_notation_file_refuses_to_build(self):
        os.remove(os.path.join(self.notation_dir, "central_atoms.csv"))
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        with self.assertRaises(BuildError) as caught:
            self.build()
        self.assertIn("central_atoms.csv", str(caught.exception))

    def test_a_malformed_notation_row_refuses_to_build(self):
        self.write_notation("central_atoms.csv", "Central notation,Atoms contributed\nC,not an element\n")
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        with self.assertRaises(BuildError) as caught:
            self.build()
        self.assertIn("central_atoms.csv", str(caught.exception))
        self.assertIn("not element symbols", str(caught.exception))

    def test_a_clean_notation_builds(self):
        # The guard above is worth nothing if it also refuses good data.
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        try:
            self.build()
        except BuildError as error:
            self.fail(f"clean data should not be refused: {error}")


class NoCsvFiles(Fixture):
    def test_refuses_rather_than_writing_an_empty_artifact(self):
        with self.assertRaises(BuildError):
            self.build()


class UnitConversion(Fixture):
    """D18: the artifact carries the kJ/mol value the site sums, converted using
    the unit the category declares - and, beside it, the value and unit as
    printed. Every real category declares kJ/mol, so this is the one place the
    rule is actually exercised.
    """

    def declare_unit(self, file, unit):
        self.write_notation("categories.csv", f"File,Quantity,Symbol,Unit,Source,Note\n{file},,,{unit},,\n")

    def test_a_kcal_mol_category_converts_to_kj_mol(self):
        self.declare_unit("01_A.csv", "kcal/mol")
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-10.00")
        [increment] = self.build()["increments"]
        self.assertEqual(increment["unit"], "kcal/mol")
        self.assertEqual(increment["storedValue"], -10.00)
        self.assertAlmostEqual(increment["value"], -10.00 * 4.184)
        self.assertNotEqual(increment["value"], increment["storedValue"],
                            "a kcal/mol row must not sum as if it were kJ/mol")

    def test_a_kcal_mol_range_converts_both_bounds(self):
        self.declare_unit("05_A.csv", "kcal/mol")
        self.write_csv("05_A.csv", "Substituent,Value\nF,1.00 to 2.00")
        [increment] = self.build()["increments"]
        self.assertAlmostEqual(increment["low"], 4.184)
        self.assertAlmostEqual(increment["high"], 8.368)

    def test_a_kj_mol_category_is_unaffected(self):
        self.declare_unit("01_A.csv", "kJ/mol")
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        [increment] = self.build()["increments"]
        self.assertEqual(increment["value"], increment["storedValue"])


class Reproducibility(Fixture):
    def test_building_twice_from_the_same_source_is_byte_identical(self):
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42\nC-(C)2(H)2,-20.9")
        first = json.dumps(self.build(), sort_keys=True)
        second = json.dumps(self.build(), sort_keys=True)
        self.assertEqual(first, second)

    def test_the_content_hash_does_not_depend_on_the_path_it_was_read_from(self):
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        first = self.build()["content_hash"]

        with tempfile.TemporaryDirectory() as other_csv_dir:
            with open(os.path.join(other_csv_dir, "01_A.csv"), "w", encoding="utf-8", newline="") as handle:
                handle.write("Group,Value\nC-(C)(H)3,-42")
            second = build_artifact(other_csv_dir, self.notation_dir)["content_hash"]

        self.assertEqual(first, second, "the hash is a function of the bytes read, not of where they live")

    def test_a_changed_value_changes_the_content_hash(self):
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        first = self.build()["content_hash"]
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-43")
        second = self.build()["content_hash"]
        self.assertNotEqual(first, second)


class WritingTheArtifact(Fixture):
    def test_writes_valid_json_to_the_given_path(self):
        self.write_csv("01_A.csv", "Group,Value\nC-(C)(H)3,-42")
        with tempfile.TemporaryDirectory() as out_dir:
            path = os.path.join(out_dir, "increments.json")
            written = write_artifact(path, self.csv_dir, self.notation_dir)
            with open(path, encoding="utf-8") as handle:
                self.assertEqual(json.load(handle), written)


class TheRepositoryData(unittest.TestCase):
    """The build, run over the files the site actually serves."""

    def test_the_committed_data_builds_without_a_guard_firing(self):
        try:
            artifact = build_artifact(str(ROOT / CSV_DIR), str(ROOT / NOTATION_DIR))
        except BuildError as error:
            self.fail(f"the repository's own data should build: {error}")
        self.assertEqual(len(artifact["increments"]), 236)

    def test_no_real_category_converts_a_value_yet(self):
        # D18: "Building this changes no value." Every category on main
        # declares kJ/mol, so every increment's stored and summed value agree.
        artifact = build_artifact(str(ROOT / CSV_DIR), str(ROOT / NOTATION_DIR))
        for increment in artifact["increments"]:
            with self.subTest(label=increment["label"]):
                self.assertEqual(increment["unit"], "kJ/mol")
                self.assertEqual(increment["value"], increment["storedValue"])

    def test_the_committed_artifact_is_what_the_build_produces(self):
        # The same bargain manifest.json and the asset version already keep:
        # CI regenerates and diffs, so a stale committed copy is a real fault.
        path = ROOT / ARTIFACT_PATH
        self.assertTrue(path.exists(), f"{ARTIFACT_PATH} is missing - run: python tools/build_dist.py")
        with open(path, encoding="utf-8") as handle:
            committed = json.load(handle)
        built = build_artifact(str(ROOT / CSV_DIR), str(ROOT / NOTATION_DIR))
        self.assertEqual(committed, built)


if __name__ == "__main__":
    unittest.main()
