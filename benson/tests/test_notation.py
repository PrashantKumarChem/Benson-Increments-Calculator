"""Tests for reading Benson notation.

Ported case for case from tools/notation.test.mjs, which keeps testing
assets/notation.js until the website stops parsing. The load-bearing one is
"every name in the data is understood": it fails the moment somebody adds a
group built on a central the notation files have never heard of, which is the
way a formula would otherwise end up quietly short of an atom. The worked
molecules are built from the real rows rather than from numbers typed in here.

The loading tests at the end are the rules tools/validate_data.py enforced on
the notation files by itself until they moved here, and the one the browser
enforced that it did not: a row with nothing before its comma.

    python -m unittest discover -s benson/tests -t .
"""
import dataclasses
import os
import tempfile
import unittest
from pathlib import Path

from benson.data import CSV_DIR, NOTATION_DIR, find_categories
from benson.notation import (
    ENERGY,
    GROUP,
    NAMED,
    UNREADABLE,
    InvalidCompositionError,
    Match,
    aliases_for,
    build_index,
    empty_notation,
    formula_of,
    load_notation,
    parse_composition,
    read,
    score_of,
    search,
    summarise,
)

ROOT = Path(__file__).resolve().parents[2]

categories = find_categories(str(ROOT / CSV_DIR))
notation = load_notation(str(ROOT / NOTATION_DIR))
index = build_index(categories, notation)

every_label = [(category.file, label) for category in categories for label, _ in category.rows]


def molecule(parts):
    """Describe a molecule as (group name, how many) and add up its formula."""
    return summarise(parts, notation)


def top(query):
    found = search(query, index)
    return found[0].label if found else None


# ---------------------------------------------------------------------------
# The notation files themselves
# ---------------------------------------------------------------------------

class TheNotationFiles(unittest.TestCase):
    def test_the_notation_files_load_without_a_single_unreadable_row(self):
        self.assertEqual(notation.problems, [])
        self.assertTrue(notation.centrals, "central_atoms.csv is empty")
        self.assertTrue(notation.ligands, "ligand_atoms.csv is empty")
        self.assertTrue(notation.synonyms, "synonyms.csv is empty")

    def test_what_a_ligand_contributes_is_read_from_the_data_not_assumed(self):
        # Hydrogen is counted inside a group because it never has a group of its
        # own. That is a statement about the method, so it lives in
        # ligand_atoms.csv - and taking it away must change what a group is made of.
        self.assertEqual(notation.ligands.get("H"), {"H": 1})

        without_ligands = dataclasses.replace(notation, ligands={})
        self.assertEqual(read("C-(C)(H)3", without_ligands).atoms, {"C": 1})
        self.assertEqual(read("C-(C)(H)3", notation).atoms, {"C": 1, "H": 3})

    def test_every_synonym_names_a_group_that_really_exists(self):
        known = {label for _, label in every_label}
        orphans = [label for label in notation.synonyms if label not in known]
        self.assertEqual(orphans, [], "synonyms.csv names groups that are no longer in the data")

    def test_every_spelled_out_name_still_exists_in_the_data(self):
        known = {label for _, label in every_label}
        orphans = [label for label in notation.named if label not in known]
        self.assertEqual(orphans, [], "special_labels.csv names groups that are no longer in the data")


# ---------------------------------------------------------------------------
# Reading a name
# ---------------------------------------------------------------------------

class ReadingAName(unittest.TestCase):
    def test_every_name_in_the_data_is_understood(self):
        unreadable = [
            f"{file}: {label} - {read(label, notation).reason}"
            for file, label in every_label
            if read(label, notation).kind == UNREADABLE and label not in notation.named
        ]
        self.assertEqual(unreadable, [],
                         "add the missing central notation to notation/central_atoms.csv, or the "
                         "whole name to notation/special_labels.csv")

    def test_a_groups_atoms_are_its_central_plus_its_hydrogen_ligands(self):
        self.assertEqual(read("C-(C)(H)3", notation).atoms, {"C": 1, "H": 3})
        self.assertEqual(read("C-(C)2(H)2", notation).atoms, {"C": 1, "H": 2})
        self.assertEqual(read("O-(H)(C)", notation).atoms, {"O": 1, "H": 1})
        self.assertEqual(read("CO-(C)2", notation).atoms, {"C": 1, "O": 1})
        self.assertEqual(read("ONO-(C)", notation).atoms, {"N": 1, "O": 2})

    def test_a_reading_names_the_central_and_every_ligand_with_its_count(self):
        reading = read("C-(C)2(H)2", notation)
        self.assertEqual(reading.central, "C")
        self.assertEqual(reading.ligands, (("C", 2), ("H", 2)))
        self.assertEqual(reading.ligand_atoms, {"H": 2})

    def test_a_ligand_that_is_not_hydrogen_contributes_nothing(self):
        # The carbons in (C)3 belong to their own groups; counting them here would
        # count every carbon in the molecule as many times as it has neighbours.
        self.assertEqual(read("C-(C)3(H)", notation).atoms, {"C": 1, "H": 1})
        self.assertEqual(read("N-(C)3", notation).atoms, {"N": 1})

    def test_corrections_and_a_values_are_energy_terms_not_groups(self):
        for label in ["cyclohexane", "Gauche alkane", "cis correction", "cyclooctene (cis)",
                      "CH3", "OCH3", "C(CH3)3", "CO2-", "F"]:
            with self.subTest(label=label):
                self.assertEqual(read(label, notation).kind, ENERGY)

    def test_a_row_that_only_looks_like_a_group_adds_no_atoms(self):
        # 'Cis- (one t-butyl)' sits in 01_CH_Groups.csv and starts like a group name.
        reading = read("Cis- (one t-butyl)", notation)
        self.assertEqual(reading.kind, NAMED)
        self.assertEqual(reading.atoms, {})

    def test_one_value_covering_two_groups_counts_both_carbons(self):
        # 'Ct-(CB) + CB-(Ct)' is a single row holding two groups; reading it as one
        # central atom would lose a carbon without anything saying so.
        reading = read("Ct-(CB) + CB-(Ct)", notation)
        self.assertEqual(reading.kind, NAMED)
        self.assertEqual(reading.atoms, {"C": 2})

    def test_a_name_whose_composition_is_unsettled_is_reported_not_treated_as_empty(self):
        reading = read("[COd]-Cd(H)2", notation)
        self.assertEqual(reading.kind, UNREADABLE)
        self.assertRegex(reading.reason, "settled")

    def test_a_group_built_on_an_unknown_central_is_reported(self):
        reading = read("S-(C)2", notation)
        self.assertEqual(reading.kind, UNREADABLE)
        self.assertRegex(reading.reason, r"central_atoms\.csv")


# ---------------------------------------------------------------------------
# Compositions and formulae
# ---------------------------------------------------------------------------

class CompositionsAndFormulae(unittest.TestCase):
    def test_a_composition_is_element_symbols_with_optional_counts(self):
        self.assertEqual(parse_composition("C"), {"C": 1})
        self.assertEqual(parse_composition("N O2"), {"N": 1, "O": 2})
        self.assertEqual(parse_composition("C2"), {"C": 2})
        self.assertEqual(parse_composition("none"), {})
        self.assertIsNone(parse_composition("unknown"))
        with self.assertRaises(InvalidCompositionError):
            parse_composition("carbon")
        with self.assertRaises(InvalidCompositionError):
            parse_composition("")

    def test_the_same_element_written_twice_is_counted_twice(self):
        self.assertEqual(parse_composition("C H C"), {"C": 2, "H": 1})
        self.assertEqual(parse_composition(" C  H2 "), {"C": 1, "H": 2})

    def test_surrounding_space_is_not_part_of_the_answer(self):
        for text, expected in [(" none ", {}), (" unknown ", None), (" C ", {"C": 1})]:
            with self.subTest(text=text):
                try:
                    atoms = parse_composition(text)
                except InvalidCompositionError as error:
                    self.fail(f"{text!r} is an answer with space around it, not a malformed one: {error}")
                self.assertEqual(atoms, expected)

    def test_anything_but_symbols_and_counts_is_refused(self):
        # The rule the validator applies to every composition in notation/.
        for text in ["c", "2C", "N,O2", "CO2x", "Cl-", "C 2"]:
            with self.subTest(text=text):
                with self.assertRaises(InvalidCompositionError, msg=f"{text!r} is not a composition"):
                    parse_composition(text)

    def test_a_refused_composition_is_still_a_value_error(self):
        self.assertTrue(issubclass(InvalidCompositionError, ValueError),
                        "callers that catch ValueError must still catch a bad composition")

    def test_a_formula_is_written_carbon_hydrogen_then_the_rest_alphabetically(self):
        self.assertEqual(formula_of({"H": 22, "C": 10}), "C10H22")
        self.assertEqual(formula_of({"O": 1, "C": 2, "H": 6}), "C2H6O")
        self.assertEqual(formula_of({"N": 1, "C": 2, "H": 3}), "C2H3N")
        self.assertEqual(formula_of({"C": 1, "H": 1}), "CH")
        self.assertEqual(formula_of({"C": 0, "H": 2, "O": 1}), "H2O")

    def test_carbon_and_hydrogen_lead_even_where_the_alphabet_would_not_put_them(self):
        # Every case above is also alphabetical, so plain sorting would pass it.
        # An element that sorts before H is where Hill order shows.
        self.assertEqual(formula_of({"Cl": 1, "C": 1, "H": 3}), "CH3Cl")
        self.assertEqual(formula_of({"Br": 1, "C": 2, "H": 5}), "C2H5Br")


# ---------------------------------------------------------------------------
# Molecules
# ---------------------------------------------------------------------------

class Molecules(unittest.TestCase):
    def test_a_molecules_formula_is_the_sum_of_the_groups_chosen_for_it(self):
        cases = [
            ([("C-(C)(H)3", 2), ("C-(C)2(H)2", 8)], "C10H22"),                     # decane
            ([("C-(C)(H)3", 1), ("C-(H)2(O)(C)", 1), ("O-(H)(C)", 1)], "C2H6O"),   # ethanol
            ([("CB-(H)", 6)], "C6H6"),                                             # benzene
            ([("C-(C)(H)3", 2), ("CO-(C)2", 1)], "C3H6O"),                         # acetone
            ([("Cd-(H)2", 2), ("C(allene)", 1)], "C3H4"),                          # allene
            ([("C-(C)(H)3", 1), ("CN-(C)", 1)], "C2H3N"),                          # acetonitrile
        ]
        for parts, expected in cases:
            with self.subTest(molecule=" + ".join(f"{n}x {label}" for label, n in parts)):
                self.assertEqual(molecule(parts).formula, expected)

    # A C=N is written as two groups, one for each end: the carbon is a `CdN` and
    # the nitrogen an `NI`. Each end must contribute only its own atom, exactly as
    # the two carbons of a C=C do. central_atoms.csv once gave `CdN` a nitrogen as
    # well, so every imine came out with one nitrogen too many - methanimine, which
    # has one, summarised to CH3N2. Nothing displayed it, because the formula is
    # not shown yet, so only a test can keep this from coming back.
    def test_the_nitrogen_of_a_c_n_is_counted_once_by_ni_and_not_also_by_cdn(self):
        self.assertEqual(read("CdN-(H)2", notation).atoms, {"C": 1, "H": 2})
        self.assertEqual(read("NI-(H)", notation).atoms, {"N": 1, "H": 1})

        # `CdN` is a `Cd` whose partner happens to be nitrogen, so the two central
        # notations stand for the same atoms.
        self.assertEqual(read("CdN-(H)2", notation).atoms, read("Cd-(H)2", notation).atoms,
                         "CdN should contribute what Cd contributes")

        self.assertEqual(molecule([("CdN-(H)2", 1), ("NI-(H)", 1)]).formula, "CH3N")  # methanimine
        self.assertEqual(molecule([("CdN-(H)2", 1), ("NI-(C)", 1), ("C-(H)3(N)", 1)]).formula,
                         "C2H5N")                                                    # N-methylmethanimine

    def test_a_ring_correction_adds_energy_but_no_atoms(self):
        summary = molecule([("C-(C)2(H)2", 6), ("cyclohexane", 1)])
        self.assertEqual(summary.formula, "C6H12")
        self.assertEqual(summary.groups, 6)
        self.assertEqual(summary.energy, 1)

    def test_anything_unreadable_means_no_formula_at_all_rather_than_a_short_one(self):
        summary = molecule([("C-(C)(H)3", 2), ("[COd]-Cd(H)2", 1)])
        self.assertIsNone(summary.formula)
        self.assertEqual(len(summary.unreadable), 1)
        self.assertEqual(summary.unreadable[0].label, "[COd]-Cd(H)2")

    def test_corrections_on_their_own_produce_no_formula(self):
        summary = molecule([("cyclohexane", 1)])
        self.assertIsNone(summary.formula)
        self.assertEqual(summary.groups, 0)
        self.assertEqual(summary.energy, 1)


# ---------------------------------------------------------------------------
# Searching
# ---------------------------------------------------------------------------

class Searching(unittest.TestCase):
    def test_a_group_is_findable_by_the_shorthand_a_student_writes(self):
        self.assertEqual(top("CH3"), "C-(C)(H)3")
        self.assertEqual(top("CH2"), "C-(C)2(H)2")
        self.assertEqual(top("CH"), "C-(C)3(H)")
        self.assertEqual(top("OH"), "O-(H)(C)")
        self.assertEqual(top("NH2"), "N-(H)2(C)")
        self.assertEqual(top("ch3"), "C-(C)(H)3", "searching should not care about case")

    def test_the_notation_itself_still_finds_a_group(self):
        self.assertEqual(top("C-(C)(H)3"), "C-(C)(H)3")
        self.assertEqual(top("O-(H)2"), "O-(H)2")
        self.assertEqual(top("CO-(C)(Cd)"), "CO-(C)(Cd)")
        self.assertEqual(top("cyclohexane"), "cyclohexane")

    def test_half_typed_notation_offers_the_family_it_belongs_to(self):
        # 'O-(H)' reads as an oxygen carrying one hydrogen, so the alcohol oxygen is
        # the exact answer and the rest of the O-(H) rows follow it.
        labels = [entry.label for entry in search("O-(H)", index)]
        self.assertEqual(labels[0], "O-(H)(C)")
        for expected in ["O-(H)2", "O-(H)(Cd)", "O-(H)(CB)", "O-(H)(Ct)"]:
            self.assertIn(expected, labels, f"expected {expected} among the matches")

    def test_a_curated_name_finds_its_group(self):
        self.assertEqual(top("methyl"), "C-(C)(H)3")
        self.assertEqual(top("methylene"), "C-(C)2(H)2")
        self.assertEqual(top("ketone"), "CO-(C)2")
        self.assertEqual(top("nitrile"), "CN-(C)")

    def test_a_group_does_not_answer_to_another_groups_name(self):
        # ONO and NO2 are both a nitrogen and two oxygens, and CdN, NC and CN are all
        # a carbon and a nitrogen - but a nitrite ester is not a nitro group and an
        # imine is not a nitrile. Searching must not put one at the top under the
        # other's name; they are tens of kJ/mol apart.
        self.assertEqual(top("NO2"), "NO2-(C)")
        self.assertEqual(top("CN"), "CN-(C)")

        self.assertNotIn("no2", aliases_for("ONO-(C)", notation))
        self.assertNotIn("cn", aliases_for("NC-(C)", notation))
        self.assertNotIn("cn", aliases_for("CdN-(C)2", notation))

        # Each is still findable by the notation it is actually written in.
        self.assertEqual(top("ONO"), "ONO-(C)")
        self.assertEqual(top("NC"), "NC-(C)")
        self.assertRegex(top("CdN"), "^CdN-")

    def test_the_bonding_is_searchable_when_a_student_wants_it(self):
        self.assertIn("cdh2", aliases_for("Cd-(H)2", notation))
        self.assertIn("ch2", aliases_for("Cd-(H)2", notation), "a double bond is still a CH2 to type")
        self.assertEqual(top("CdH2"), "Cd-(H)2")

    def test_an_exact_match_outranks_a_partial_one(self):
        self.assertEqual(score_of("ch3", ["ch3"]), Match.EXACT)
        self.assertEqual(score_of("ch3", ["ch3o"]), Match.PREFIX)
        self.assertEqual(score_of("ch3", ["och3"]), Match.CONTAINS)
        self.assertIsNone(score_of("ch3", ["cd"]))

        results = search("CH3", index)
        labels = [entry.label for entry in results]
        self.assertEqual(results[0].score, Match.EXACT)
        self.assertIn("OCH3", labels, "a weaker match should still be offered")
        self.assertGreater(labels.index("OCH3"), labels.index("C-(C)(H)3"), "but below the exact one")

    def test_ties_are_settled_by_the_order_the_data_is_written_in(self):
        # Seven groups match 'CH3' exactly. The CSV files run simplest first, so the
        # plain methyl comes out on top without this code ranking chemistry itself.
        exact = [entry for entry in search("CH3", index) if entry.score == Match.EXACT]
        self.assertGreater(len(exact), 1, "expected several exact matches to tie")
        self.assertEqual(exact[0].label, "C-(C)(H)3")
        for previous, current in zip(exact, exact[1:]):
            self.assertLess((previous.category_index, previous.row_index),
                            (current.category_index, current.row_index),
                            "exact matches should stay in data order")

    def test_searching_for_nothing_matches_nothing(self):
        self.assertEqual(search("", index), [])
        self.assertEqual(search("   ", index), [])
        self.assertEqual(search("zzzz", index), [])

    def test_a_query_of_nothing_but_punctuation_scores_nothing(self):
        # Every alias starts with the empty string, so without this each would
        # count as a prefix match for a query that normalises to nothing.
        self.assertIsNone(score_of("", ["ch3"]))
        self.assertIsNone(score_of(" -() ", ["ch3"]))

    def test_the_index_covers_every_increment_exactly_once(self):
        self.assertEqual(len(index), len(every_label))

    def test_searching_still_works_when_the_notation_files_are_missing(self):
        # A missing file leaves empty tables rather than a second search, so this
        # path is the same code as every other search - a group is just findable
        # by its printed name alone.
        bare = build_index(categories, empty_notation())

        self.assertEqual(search("C-(C)(H)3", bare)[0].label, "C-(C)(H)3")
        self.assertEqual(search("cyclohexane", bare)[0].label, "cyclohexane")

        # What is lost is exactly what the files provide: the shorthand a group
        # stands for, and the words people call it by.
        self.assertEqual(search("methyl", bare), [])
        self.assertNotIn("C-(C)2(H)2", [entry.label for entry in search("CH2", bare)],
                         "without the files a methylene is not findable as CH2")
        self.assertEqual(top("CH2"), "C-(C)2(H)2", "with them it is the first hit")

    def test_a_result_says_which_synonym_found_it(self):
        self.assertEqual(search("methyl", index)[0].matched_synonym, "methyl")
        self.assertEqual(search("ketone", index)[0].matched_synonym, "ketone")
        self.assertEqual(search("nitro", index)[0].matched_synonym, "nitro")
        self.assertIsNone(search("C-(C)(H)3", index)[0].matched_synonym, "the notation is not a synonym")

    def test_a_synonym_is_only_credited_when_it_is_what_answered(self):
        # 'alcohol' contains the letters of OH, but O-(H)(C) is found by its notation
        # reading exactly; crediting the synonym there would be a small lie.
        first = search("OH", index)[0]
        self.assertEqual(first.label, "O-(H)(C)")
        self.assertIn("alcohol", first.synonyms)
        self.assertIsNone(first.matched_synonym)

    def test_an_entry_keeps_its_row_as_read(self):
        # The index is what a page renders a card from. Narrowing an entry to its
        # label would lose how the source wrote the value, so the row comes along.
        methylene = next(entry for entry in index if entry.label == "C-(C)2(H)2")
        self.assertEqual(methylene.row, ("C-(C)2(H)2", "-20.9"))
        self.assertEqual(methylene.category.file, "01_CH_Groups.csv")


# ---------------------------------------------------------------------------
# Loading: the rules each notation file is held to
# ---------------------------------------------------------------------------

GOOD = {
    "central_atoms.csv": "Central notation,Atoms contributed\nC,C\nCO,C O",
    "ligand_atoms.csv": "Ligand,Atoms contributed\nH,H",
    "special_labels.csv": "Group,Atoms contributed\ncyclohexane,none",
    "synonyms.csv": "Group,Synonym\nC-(C)(H)3,methyl",
}


class Loading(unittest.TestCase):
    def load(self, **replaced):
        """Load a notation folder holding GOOD, with some files replaced or (None) removed."""
        with tempfile.TemporaryDirectory() as folder:
            for name, text in {**GOOD, **{k.replace("__", "."): v for k, v in replaced.items()}}.items():
                if text is None:
                    continue
                with open(os.path.join(folder, name), "w", encoding="utf-8", newline="") as handle:
                    handle.write(text)
            return load_notation(folder)

    def messages(self, loaded):
        return [f"{p.file}:{p.line}: {p.message}" for p in loaded.problems]

    def test_a_good_folder_loads_with_no_problems(self):
        loaded = self.load()
        self.assertEqual(loaded.problems, [])
        self.assertEqual(loaded.centrals, {"C": {"C": 1}, "CO": {"C": 1, "O": 1}})
        self.assertEqual(loaded.named, {"cyclohexane": {}})
        self.assertEqual(loaded.synonyms, {"C-(C)(H)3": ["methyl"]})

    def test_a_key_answered_twice_is_refused_and_the_first_answer_kept(self):
        loaded = self.load(central_atoms__csv="Central notation,Atoms contributed\nC,C\nC,N")
        self.assertEqual(self.messages(loaded), ["central_atoms.csv:3: 'C' is already answered on line 2"])
        self.assertEqual(loaded.centrals["C"], {"C": 1})

    def test_a_group_may_have_several_synonyms(self):
        loaded = self.load(synonyms__csv="Group,Synonym\nC-(C)(H)3,methyl\nC-(C)(H)3,CH3 group")
        self.assertEqual(loaded.problems, [])
        self.assertEqual(loaded.synonyms["C-(C)(H)3"], ["methyl", "CH3 group"])

    def test_unknown_is_refused_where_an_answer_is_required(self):
        loaded = self.load(central_atoms__csv="Central notation,Atoms contributed\nC,C\nX,unknown",
                           ligand_atoms__csv="Ligand,Atoms contributed\nH,unknown")
        self.assertEqual(self.messages(loaded), [
            "central_atoms.csv:3: 'X' cannot be 'unknown' - a central notation must say what it is",
            "ligand_atoms.csv:2: 'H' cannot be 'unknown' - a ligand must say what it is",
        ])
        self.assertNotIn("X", loaded.centrals)

    def test_unknown_is_an_answer_for_a_spelled_out_name(self):
        loaded = self.load(special_labels__csv="Group,Atoms contributed\n[COd]-Cd(H)2,unknown")
        self.assertEqual(loaded.problems, [])
        self.assertIsNone(loaded.named["[COd]-Cd(H)2"])

    def test_a_malformed_composition_is_refused_by_name(self):
        loaded = self.load(central_atoms__csv="Central notation,Atoms contributed\nCB,carbon")
        self.assertEqual(self.messages(loaded), [
            "central_atoms.csv:2: 'CB': 'carbon' is not element symbols with optional counts, "
            "like 'C', 'N O2' or 'C2'"])
        self.assertNotIn("CB", loaded.centrals)

    def test_a_synonym_is_free_text_not_a_composition(self):
        loaded = self.load(synonyms__csv="Group,Synonym\nCO-(C)2,ketone")
        self.assertEqual(loaded.problems, [])

    def test_a_row_with_no_value_is_refused(self):
        loaded = self.load(synonyms__csv="Group,Synonym\nC-(C)(H)3,\njust a name")
        self.assertEqual(self.messages(loaded), [
            "synonyms.csv:2: 'C-(C)(H)3' has no value",
            "synonyms.csv:3: 'just a name' has no value",
        ])

    def test_a_row_with_nothing_before_its_comma_is_refused(self):
        loaded = self.load(central_atoms__csv="Central notation,Atoms contributed\nC,C\n,N")
        self.assertEqual(self.messages(loaded), ["central_atoms.csv:3: 'N' has no name before the comma"])
        self.assertNotIn("", loaded.centrals)

    def test_a_missing_file_is_reported_and_the_rest_still_load(self):
        loaded = self.load(ligand_atoms__csv=None)
        self.assertEqual(self.messages(loaded),
                         ["ligand_atoms.csv:0: missing - the calculator reads notation/ligand_atoms.csv"])
        self.assertEqual(loaded.ligands, {})
        self.assertEqual(loaded.named, {"cyclohexane": {}}, "the files after it must still load")
        self.assertEqual(loaded.synonyms, {"C-(C)(H)3": ["methyl"]})


if __name__ == "__main__":
    unittest.main()
