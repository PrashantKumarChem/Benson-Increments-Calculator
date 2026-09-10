/**
 * Does the increment data agree with reality?
 *
 * Every other check in this repository proves the tool is internally
 * consistent. check_parity.mjs proves the notebook and the site read all 236
 * increments identically; validate_data.py proves the files are well formed.
 * None of them can notice a value that was mistranscribed from the published
 * table, because a wrong number is copied faithfully into both consumers and
 * satisfies every one of those rules.
 *
 * This test closes that gap the only way it can be closed: by summing groups
 * for real molecules and comparing the total against an experimental
 * gas-phase enthalpy of formation looked up in the literature.
 *
 * The molecules are decomposed by hand below. That is deliberate - structure
 * perception is an explicit non-goal for this project, so the decomposition is
 * data here rather than something the test works out.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadCategories } from "../assets/benson.js";
import { createSelection } from "../assets/selection.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relative) => readFile(path.join(ROOT, relative), "utf8");

const categories = await loadCategories({ readText });

const CH = "01_CH_Groups.csv";
const CHO = "02_CHO_Groups.csv";
const CHNO = "03_CHNO_Groups.csv";
const CORRECTIONS = "04_Corrections.csv";

/**
 * Tolerance, in kJ/mol.
 *
 * Cohen 1996 reports a mean absolute error of about 5.5 kJ/mol for gas-phase
 * enthalpy of formation by group additivity. Individual molecules scatter above
 * a mean absolute error by definition, so a per-molecule bound has to sit above
 * it: PER_MOLECULE is twice the reported figure, the smallest round multiple
 * that ordinary method scatter does not breach.
 *
 * PER_MOLECULE is the bound that actually binds, and MEAN_ABSOLUTE is not a
 * second line of defence behind it. One wrong increment is concentrated in the
 * few molecules that use it, so it breaches a per-molecule bound long before it
 * moves a mean taken over the whole set: for every increment this table
 * exercises, no single-value error trips MEAN_ABSOLUTE without tripping
 * PER_MOLECULE first. MEAN_ABSOLUTE is asserted because it is the same
 * statistic Cohen publishes, which is what makes this set's agreement
 * checkable against the literature rather than only against itself.
 *
 * Neither number was chosen from the observed spread, which is the point. The
 * set currently sits near 1.2 kJ/mol mean absolute error with a worst case of
 * 5.7, so both bounds have room above the data. This is a guard against an
 * increment that disagrees with the published thermochemistry, not a
 * change-detector for the CSV files - check_parity.mjs and validate_data.py
 * already cover unintended edits, and they do it to the last decimal.
 */
const PER_MOLECULE = 11.0;
const MEAN_ABSOLUTE = 5.5;
/** Ceiling on an experimental value's own uncertainty; see the table's note. */
const MAX_UNCERTAINTY = 3.0;

/**
 * Every experimental value below was retrieved from the NIST Chemistry WebBook
 * in the session that wrote this file. Nothing here is recalled or estimated: a
 * remembered number would assert that a wrong value is right while looking
 * like verification, which is worse than having no test at all. The rule this
 * follows is written out in .claude/rules/citations.md.
 *
 * Each entry carries four things, because a value needs to be both
 * attributable and retrievable and no single field is both:
 *
 *   `url`       the NIST page the value was read from, which shows the value
 *   `reference` the short form NIST prints, for finding the row on that page
 *   `citation`  authors, title, journal, year, volume, pages
 *   `doi`       a resolvable link to the paper itself, or null
 *
 * The short form alone is not enough, and this data set is where that stops
 * being theoretical. `Prosen and Rossini, 1945` is two different papers here -
 * the paraffins (J. Res. NBS 34, 263) for hexane and octane, and 1,3-butadiene
 * and styrene (J. Res. NBS 34, 59) for styrene. `Prosen, Johnson, et al., 1946`
 * is likewise two: the alkylcyclopentanes and cyclohexanes (37, 51) for
 * cyclohexane, and the alkylbenzenes (36, 455) for p-xylene. Same authors, same
 * year, same journal. Only the full citation and the DOI tell them apart.
 *
 * Bibliographic fields were quoted from the References section of each
 * molecule's own NIST page. Every DOI was then resolved through Crossref and
 * accepted only when the returned title, journal, volume, first page and year
 * all matched that citation - so each one is corroborated by two independent
 * records rather than asserted from one. No DOI was composed by hand; they are
 * opaque strings and a guessed suffix points at a real but different paper.
 *
 * The two NIST compiled averages have no primary paper, so they cite the
 * database itself, whose own DOI resolves to it. One entry carries `doi: null`
 * rather than a plausible guess: Issoire and Long 1960, whose Bull. Soc. Chim.
 * France volume Crossref does not index - its best match was a 1984
 * encyclopedia entry, so none is claimed and the NIST page is the only
 * retrievable record for that value.
 *
 * Where a page offered several gas-phase rows, one rule picked between them,
 * fixed before the values were inspected and applied to every molecule:
 *
 *   1. the most recent critical review or evaluation, if one is listed;
 *   2. else the most recent determination carrying a stated uncertainty;
 *   3. else the most recent remaining row.
 *
 * Two kinds of row are excluded from all three: a row with no reference at all,
 * which cannot be cited, and a row NIST flags as computed from a condensed-phase
 * enthalpy plus a vaporization or sublimation enthalpy, which is a derived
 * quantity carrying unquantified error. A molecule is left out of the table
 * entirely when its stated uncertainty exceeds 3 kJ/mol - well inside the
 * method's own 5.5 kJ/mol error, so that the experimental figure is never the
 * limiting term in the comparison. `uncertainty: null` means NIST printed the
 * value without one.
 *
 * `groups` is the Benson decomposition, as [category file, group label, count].
 */
const MOLECULES = [
  {
    name: "n-butane",
    groups: [[CH, "C-(C)(H)3", 2], [CH, "C-(C)2(H)2", 2]],
    experimental: -125.6,
    uncertainty: 0.67,
    method: "Ccb",
    reference: "Pittam and Pilcher, 1972",
    citation:
      "Pittam, D.A.; Pilcher, G., 'Measurements of heats of combustion by flame calorimetry. " +
      "Part 8. Methane, ethane, propane, n-butane and 2-methylpropane', J. Chem. Soc. Faraday " +
      "Trans. 1, 1972, 68, 2224-2229",
    doi: "10.1039/f19726802224",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C106978&Units=SI&Mask=1",
  },
  {
    name: "isobutane",
    groups: [[CH, "C-(C)(H)3", 3], [CH, "C-(C)3(H)", 1]],
    experimental: -134.2,
    uncertainty: 0.63,
    method: "Ccb",
    reference: "Pittam and Pilcher, 1972",
    citation:
      "Pittam, D.A.; Pilcher, G., 'Measurements of heats of combustion by flame calorimetry. " +
      "Part 8. Methane, ethane, propane, n-butane and 2-methylpropane', J. Chem. Soc. Faraday " +
      "Trans. 1, 1972, 68, 2224-2229",
    doi: "10.1039/f19726802224",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C75285&Units=SI&Mask=1",
  },
  {
    name: "n-pentane",
    groups: [[CH, "C-(C)(H)3", 2], [CH, "C-(C)2(H)2", 3]],
    experimental: -146.8,
    uncertainty: 0.59,
    method: "Ccb",
    reference: "Good, 1970",
    citation:
      "Good, W.D., 'The enthalpies of combustion and formation of the isomeric pentanes', J. " +
      "Chem. Thermodyn., 1970, 2, 237-244",
    doi: "10.1016/0021-9614(70)90088-1",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C109660&Units=SI&Mask=1",
  },
  {
    name: "n-hexane",
    groups: [[CH, "C-(C)(H)3", 2], [CH, "C-(C)2(H)2", 4]],
    experimental: -167.2,
    uncertainty: 0.79,
    method: "Ccb",
    reference: "Prosen and Rossini, 1945",
    citation:
      "Prosen, E.J.; Rossini, F.D., 'Heats of combustion and formation of the paraffin " +
      "hydrocarbons at 25 degrees C', J. Res. NBS, 1945, 34, 263-267",
    doi: "10.6028/jres.034.013",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C110543&Units=SI&Mask=1",
  },
  {
    name: "n-octane",
    groups: [[CH, "C-(C)(H)3", 2], [CH, "C-(C)2(H)2", 6]],
    experimental: -208.4,
    uncertainty: 0.67,
    method: "Ccb",
    reference: "Prosen and Rossini, 1945",
    citation:
      "Prosen, E.J.; Rossini, F.D., 'Heats of combustion and formation of the paraffin " +
      "hydrocarbons at 25 degrees C', J. Res. NBS, 1945, 34, 263-267",
    doi: "10.6028/jres.034.013",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C111659&Units=SI&Mask=1",
  },
  {
    // The ring corrections carry the whole of the strain energy, so a cyclic
    // molecule tests a correction row against reality rather than a group row.
    name: "cyclopropane",
    groups: [[CH, "C-(C)2(H)2", 3], [CORRECTIONS, "cyclopropane", 1]],
    experimental: 53.30,
    uncertainty: 0.59,
    method: "Cm",
    reference: "Knowlton and Rossini, 1949",
    citation:
      "Knowlton, J.W.; Rossini, F.D., 'Heats of combustion and formation of cyclopropane', J. " +
      "Res. NBS, 1949, 43, 113-115",
    doi: "10.6028/jres.043.013",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C75194&Units=SI&Mask=1",
  },
  {
    name: "cyclopentane",
    groups: [[CH, "C-(C)2(H)2", 5], [CORRECTIONS, "cyclopentane", 1]],
    experimental: -76.40,
    uncertainty: 0.79,
    method: "Ccb",
    reference: "McCullough, Pennington, et al., 1959",
    citation:
      "McCullough, J.P.; Pennington, R.E.; Smith, J.C.; Hossenlopp, I.A.; Waddington, G., " +
      "'Thermodynamics of cyclopentane, methylcyclopentane and 1,cis-3-dimethylcyclopentane: " +
      "Verification of the concept of pseudorotation', J. Am. Chem. Soc., 1959, 81, 5880-5883",
    doi: "10.1021/ja01531a009",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C287923&Units=SI&Mask=1",
  },
  {
    name: "cyclohexane",
    groups: [[CH, "C-(C)2(H)2", 6], [CORRECTIONS, "cyclohexane", 1]],
    experimental: -123.1,
    uncertainty: 0.79,
    method: "Ccb",
    reference: "Prosen, Johnson, et al., 1946",
    citation:
      "Prosen, E.J.; Johnson, W.H.; Rossini, F.D., 'Heats of formation and combustion of the " +
      "normal alkylcyclopentanes and cyclohexanes and the increment per CH2 group for several " +
      "homologous series of hydrocarbons', J. Res. NBS, 1946, 37, 51-56",
    doi: "10.6028/jres.037.031",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C110827&Units=SI&Mask=1",
  },
  {
    name: "cyclohexene",
    groups: [[CH, "C-(C)2(H)2", 4], [CH, "Cd-(C)(H)", 2], [CORRECTIONS, "cyclohexene", 1]],
    experimental: -4.32,
    uncertainty: 0.98,
    method: "Ccr",
    reference: "Steele, Chirico, et al., 1996",
    citation:
      "Steele, W.V.; Chirico, R.D.; Knipmeyer, S.E.; Nguyen, A.; Smith, N.K.; Tasker, I.R., " +
      "'Thermodynamic properties and ideal-gas enthalpies of formation for cyclohexene, " +
      "phthalan (2,5-dihydrobenzo-3,4-furan), isoxazole, octylamine, dioctylamine, " +
      "trioctylamine, phenyl isocyanate, and 1,4,5,6-tetrahydropyrimidine', J. Chem. Eng. Data, " +
      "1996, 41, 1269-1284",
    doi: "10.1021/je960093t",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C110838&Units=SI&Mask=1",
  },
  {
    name: "propene",
    groups: [[CH, "Cd-(H)2", 1], [CH, "Cd-(C)(H)", 1], [CH, "C-(Cd)(H)3", 1]],
    experimental: 20.41,
    // NIST prints no uncertainty, but a second, independent row on the same
    // page (Lacher, Walden, et al., 1950, Cm) gives the same 20.41.
    uncertainty: null,
    method: "Eqk",
    reference: "Furuyama, Golden, et al., 1969",
    citation:
      "Furuyama, S.; Golden, D.M.; Benson, S.W., 'Thermochemistry of the gas phase equilibria " +
      "i-C3H7I = C3H6 + HI, n-C3H7I = i-C3H7I, and C3H6 + 2HI = C3H8 + I2', J. Chem. " +
      "Thermodyn., 1969, 1, 363-375",
    doi: "10.1016/0021-9614(69)90066-4",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C115071&Units=SI&Mask=1",
  },
  {
    name: "1-butene",
    groups: [[CH, "Cd-(H)2", 1], [CH, "Cd-(C)(H)", 1], [CH, "C-(Cd)(C)(H)2", 1], [CH, "C-(C)(H)3", 1]],
    experimental: -0.63,
    uncertainty: 0.79,
    method: "Cm",
    reference: "Prosen, Maron, et al., 1951",
    citation:
      "Prosen, E.J.; Maron, F.W.; Rossini, F.D., 'Heats of combustion, formation, and " +
      "insomerization of ten C4 hydrocarbons', J. Res. NBS, 1951, 46, 106-112",
    doi: "10.6028/jres.046.015",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C106989&Units=SI&Mask=1",
  },
  {
    name: "1,3-butadiene",
    groups: [[CH, "Cd-(H)2", 2], [CH, "Cd-(Cd)(H)", 2]],
    experimental: 108.8,
    uncertainty: 0.79,
    method: "Cm",
    reference: "Prosen, Maron, et al., 1951",
    citation:
      "Prosen, E.J.; Maron, F.W.; Rossini, F.D., 'Heats of combustion, formation, and " +
      "insomerization of ten C4 hydrocarbons', J. Res. NBS, 1951, 46, 106-112",
    doi: "10.6028/jres.046.015",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C106990&Units=SI&Mask=1",
  },
  {
    name: "benzene",
    groups: [[CH, "CB-(H)", 6]],
    experimental: 82.9,
    uncertainty: 0.9,
    method: "Review",
    reference: "Roux, Temprado, et al., 2008",
    citation:
      "Roux, M.V.; Temprado, M.; Chickos, J.S.; Nagano, Y., 'Critically Evaluated " +
      "Thermochemical Properties of Polycyclic Aromatic Hydrocarbons', J. Phys. Chem. Ref. " +
      "Data, 2008, 37, 1855-1996",
    doi: "10.1063/1.2955570",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C71432&Units=SI&Mask=1",
  },
  {
    name: "toluene",
    groups: [[CH, "CB-(H)", 5], [CH, "CB-(C)", 1], [CH, "C-(CB)(H)3", 1]],
    experimental: 50.1,
    uncertainty: 1.1,
    method: "Review",
    reference: "Roux, Temprado, et al., 2008",
    citation:
      "Roux, M.V.; Temprado, M.; Chickos, J.S.; Nagano, Y., 'Critically Evaluated " +
      "Thermochemical Properties of Polycyclic Aromatic Hydrocarbons', J. Phys. Chem. Ref. " +
      "Data, 2008, 37, 1855-1996",
    doi: "10.1063/1.2955570",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C108883&Units=SI&Mask=1",
  },
  {
    name: "ethylbenzene",
    groups: [[CH, "CB-(H)", 5], [CH, "CB-(C)", 1], [CH, "C-(CB)(C)(H)2", 1], [CH, "C-(C)(H)3", 1]],
    experimental: 29.8,
    uncertainty: 0.84,
    method: "Ccb",
    reference: "Prosen, Gilmont, et al., 1945",
    citation:
      "Prosen, E.J.; Gilmont, R.; Rossini, F.D., 'Heats of combustion of benzene, toluene, " +
      "ethylbenzene, o-xylene, m-xylene, p-xylene, n-propylbenzene, and styrene', J. Res. NBS, " +
      "1945, 34, 65-70",
    doi: "10.6028/jres.034.034",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C100414&Units=SI&Mask=1",
  },
  {
    // Para, so no ortho correction is in play - the two methyls are not
    // neighbours and the decomposition stays free of an interaction term.
    name: "p-xylene",
    groups: [[CH, "CB-(H)", 4], [CH, "CB-(C)", 2], [CH, "C-(CB)(H)3", 2]],
    experimental: 17.9,
    uncertainty: 1.0,
    method: "Ccb",
    reference: "Prosen, Johnson, et al., 1946",
    citation:
      "Prosen, E.J.; Johnson, W.H.; Rossini, F.D., 'Heats of combustion and formation at 25 " +
      "degrees C of the alkylbenzenes through C10H14, and of the higher normal " +
      "monoalkylbenzenes', J. Res. NBS, 1946, 36, 455-461",
    doi: "10.6028/jres.036.025",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C106423&Units=SI&Mask=1",
  },
  {
    name: "styrene",
    groups: [[CH, "CB-(H)", 5], [CH, "CB-(Cd)", 1], [CH, "Cd-(CB)(H)", 1], [CH, "Cd-(H)2", 1]],
    experimental: 146.9,
    uncertainty: 1.0,
    method: "Ccb",
    reference: "Prosen and Rossini, 1945",
    citation:
      "Prosen, E.J.; Rossini, F.D., 'Heats of formation and combustion of 1,3-butadiene and " +
      "styrene', J. Res. NBS, 1945, 34, 59-63",
    doi: "10.6028/jres.034.031",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C100425&Units=SI&Mask=1",
  },
  {
    name: "ethanol",
    groups: [[CH, "C-(C)(H)3", 1], [CHO, "C-(H)2(O)(C)", 1], [CHO, "O-(H)(C)", 1]],
    experimental: -234.0,
    uncertainty: 2.0,
    // NIST's own average of nine values; the page lists no single primary
    // reference for it, so the WebBook page is the citation.
    method: "AVG of 9 values",
    reference: "NIST Chemistry WebBook compilation",
    citation:
      "NIST Chemistry WebBook, NIST Standard Reference Database Number 69, National Institute " +
      "of Standards and Technology, Gaithersburg MD, last update 2025 - this compound page's " +
      "own average of the individual determinations it lists. NIST prints 'N/A' in the " +
      "Reference column for the averaged row, so the database itself is the cited work and " +
      "no primary paper is claimed",
    doi: "10.18434/T4D303",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Units=SI&Mask=1",
  },
  {
    name: "diethyl ether",
    groups: [[CH, "C-(C)(H)3", 2], [CHO, "C-(H)2(O)(C)", 2], [CHO, "O-(C)2", 1]],
    experimental: -252.7,
    uncertainty: 2.0,
    method: "Ccb",
    reference: "Pihlaja and Heikkil, 1968",
    citation:
      "Pihlaja, K.; Heikkila, J., 'Heats of combustion: diethyl ether and 1,1-diethoxyethane', " +
      "Acta Chem. Scand., 1968, 22, 2731-2732",
    doi: "10.3891/acta.chem.scand.22-2731",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C60297&Units=SI&Mask=1",
  },
  {
    name: "acetone",
    groups: [[CHO, "C-(H)3(CO)", 2], [CHO, "CO-(C)2", 1]],
    experimental: -218.5,
    uncertainty: 0.59,
    method: "Cm",
    reference: "Wiberg, Crocker, et al., 1991",
    citation:
      "Wiberg, K.B.; Crocker, L.S.; Morgan, K.M., 'Thermochemical studies of carbonyl " +
      "compounds. 5. Enthalpies of reduction of carbonyl groups', J. Am. Chem. Soc., 1991, 113, " +
      "3447-3450",
    doi: "10.1021/ja00009a033",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C67641&Units=SI&Mask=1",
  },
  {
    name: "acetaldehyde",
    groups: [[CHO, "C-(H)3(CO)", 1], [CHO, "CO-(H)(C)", 1]],
    experimental: -170.7,
    uncertainty: 1.5,
    method: "Chyd",
    reference: "Wiberg, Crocker, et al., 1991",
    citation:
      "Wiberg, K.B.; Crocker, L.S.; Morgan, K.M., 'Thermochemical studies of carbonyl " +
      "compounds. 5. Enthalpies of reduction of carbonyl groups', J. Am. Chem. Soc., 1991, 113, " +
      "3447-3450",
    doi: "10.1021/ja00009a033",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C75070&Units=SI&Mask=1",
  },
  {
    name: "acetic acid",
    groups: [[CHO, "C-(H)3(CO)", 1], [CHO, "CO-(C)(O)", 1], [CHO, "O-(H)(CO)", 1]],
    experimental: -433.0,
    uncertainty: 3.0,
    method: "AVG of 8 values",
    reference: "NIST Chemistry WebBook compilation",
    citation:
      "NIST Chemistry WebBook, NIST Standard Reference Database Number 69, National Institute " +
      "of Standards and Technology, Gaithersburg MD, last update 2025 - this compound page's " +
      "own average of the individual determinations it lists. NIST prints 'N/A' in the " +
      "Reference column for the averaged row, so the database itself is the cited work and " +
      "no primary paper is claimed",
    doi: "10.18434/T4D303",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C64197&Units=SI&Mask=1",
  },
  {
    name: "methyl acetate",
    groups: [[CHO, "C-(H)3(CO)", 1], [CHO, "CO-(C)(O)", 1], [CHO, "O-(C)(CO)", 1], [CHO, "C-(H)3(O)", 1]],
    experimental: -410.0,
    uncertainty: null,
    method: "Ccr",
    reference: "Hall and Baldt, 1971",
    citation:
      "Hall, H.K., Jr.; Baldt, J.H., 'Thermochemistry of strained-ring bridgehead nitriles and " +
      "esters', J. Am. Chem. Soc., 1971, 93, 140-145",
    doi: "10.1021/ja00730a025",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C79209&Units=SI&Mask=1",
  },
  {
    name: "phenol",
    groups: [[CH, "CB-(H)", 5], [CHO, "CB-(O)", 1], [CHO, "O-(H)(CB)", 1]],
    experimental: -96.36,
    uncertainty: 0.59,
    method: "Ccb",
    reference: "Cox, 1961",
    citation:
      "Cox, J.D., 'The heats of combustion of phenol and the three cresols', Pure Appl. Chem., " +
      "1961, 2, 125-128",
    doi: "10.1351/pac196102010125",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C108952&Units=SI&Mask=1",
  },
  {
    name: "benzaldehyde",
    groups: [[CH, "CB-(H)", 5], [CHO, "CB-(CO)", 1], [CHO, "CO-(H)(CB)", 1]],
    experimental: -36.8,
    uncertainty: 3.0,
    method: "Ccb",
    reference: "Ambrose, Connett, et al., 1975",
    citation:
      "Ambrose, D.; Connett, J.E.; Green, J.H.S.; Hales, J.L.; Head, A.J.; Martin, J.F., " +
      "'Thermodynamic properties of organic oxygen compounds. 42. Physical and thermodynamic " +
      "properties of benzaldehyde', J. Chem. Thermodyn., 1975, 7, 1143-1157",
    doi: "10.1016/0021-9614(75)90035-x",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C100527&Units=SI&Mask=1",
  },
  {
    // The only molecule here that exercises the pyridine-type ring nitrogen
    // groups, which are otherwise untested against anything but themselves.
    name: "pyridine",
    groups: [[CH, "CB-(H)", 3], [CHNO, "CB-(NI)(H)", 2], [CHNO, "NI-(CB)2", 1]],
    experimental: 140.6,
    uncertainty: 1.5,
    method: "Cm",
    reference: "Andon, Cox, et al., 1957",
    citation:
      "Andon, R.J.L.; Cox, J.D.; Herington, E.F.G.; Martin, J.F., 'The second virial " +
      "coefficients of pyridine and benzene, and certain of their methyl homologues', Trans. " +
      "Faraday Soc., 1957, 53, 1074",
    doi: "10.1039/tf9575301074",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C110861&Units=SI&Mask=1",
  },
  {
    name: "trimethylamine",
    groups: [[CHNO, "C-(H)3(N)", 3], [CHNO, "N-(C)3", 1]],
    experimental: -23.7,
    uncertainty: 0.75,
    method: "Eqk",
    reference: "Issoire and Long, 1960, heat of formation derived by Cox and Pilcher, 1970",
    citation:
      "Issoire, J.; Long, C., 'Etude de la thermodynamique chimique de la reaction de formation " +
      "des methylamines', Bull. Soc. Chim. France, 1960, 2004-2012; enthalpy of formation " +
      "derived by Cox, J.D.; Pilcher, G., 'Thermochemistry of Organic and Organometallic " +
      "Compounds', Academic Press, New York, 1970",
    doi: null,
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C75503&Units=SI&Mask=1",
  },
  {
    name: "propionitrile",
    groups: [[CH, "C-(C)(H)3", 1], [CHNO, "C-(H)2(C)(CN)", 1], [CHNO, "CN-(C)", 1]],
    experimental: 51.46,
    uncertainty: null,
    method: "Ccr",
    reference: "Hall and Baldt, 1971",
    citation:
      "Hall, H.K., Jr.; Baldt, J.H., 'Thermochemistry of strained-ring bridgehead nitriles and " +
      "esters', J. Am. Chem. Soc., 1971, 93, 140-145",
    doi: "10.1021/ja00730a025",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C107120&Units=SI&Mask=1",
  },
  {
    name: "aniline",
    groups: [[CH, "CB-(H)", 5], [CHNO, "CB-(N)", 1], [CHNO, "N-(H)2(CB)", 1]],
    experimental: 87.03,
    uncertainty: 0.88,
    method: "Ccb",
    reference: "Hatton, Hildenbrand, et al., 1962",
    citation:
      "Hatton, W.E.; Hildenbrand, D.L.; Sinke, G.C.; Stull, D.R., 'Chemical thermodynamic " +
      "properties of aniline', J. Chem. Eng. Data, 1962, 7, 229-231",
    doi: "10.1021/je60013a021",
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C62533&Units=SI&Mask=1",
  },
];

/** Look an increment up in the loaded data; fail loudly if the name is gone. */
function increment(file, label) {
  const category = categories.find((candidate) => candidate.file === file);
  assert.ok(category, `no category file ${file}`);
  const row = category.rows.find((candidate) => candidate.label === label);
  assert.ok(row, `no increment '${label}' in ${file}`);
  return { categoryFile: category.file, categoryTitle: category.title, label, value: row.value };
}

/** The group sum for one molecule, added up by the calculator's own arithmetic. */
function groupSum(molecule) {
  const selection = createSelection();
  for (const [file, label, count] of molecule.groups) {
    const item = increment(file, label);
    for (let i = 0; i < count; i += 1) selection.add(item);
  }
  return selection.totalKj;
}

for (const molecule of MOLECULES) {
  test(`${molecule.name} agrees with its experimental enthalpy of formation`, () => {
    const sum = groupSum(molecule);
    const miss = Math.abs(sum - molecule.experimental);

    assert.ok(
      miss <= PER_MOLECULE,
      `${molecule.name}: groups sum to ${sum.toFixed(2)} kJ/mol, experimental value ` +
      `${molecule.experimental} kJ/mol (${molecule.reference}), miss ${miss.toFixed(2)} kJ/mol ` +
      `exceeds the ${PER_MOLECULE} kJ/mol per-molecule tolerance`,
    );
  });
}

test("the whole set stays within the method's published mean absolute error", () => {
  const misses = MOLECULES.map((molecule) => Math.abs(groupSum(molecule) - molecule.experimental));
  const mean = misses.reduce((total, miss) => total + miss, 0) / misses.length;

  assert.ok(MOLECULES.length > 0, "the molecule table is empty, so nothing was compared");
  assert.ok(
    mean <= MEAN_ABSOLUTE,
    `mean absolute error is ${mean.toFixed(2)} kJ/mol over ${MOLECULES.length} molecules, ` +
    `which exceeds the ${MEAN_ABSOLUTE} kJ/mol Cohen 1996 reports for the method`,
  );
});

test("every experimental value carries a retrievable citation", () => {
  for (const molecule of MOLECULES) {
    assert.match(
      molecule.url,
      /^https:\/\/webbook\.nist\.gov\//,
      `${molecule.name} has no NIST WebBook URL`,
    );
    assert.ok(molecule.reference?.trim(), `${molecule.name} has no reference`);
    assert.ok(molecule.method?.trim(), `${molecule.name} has no method`);

    // A full citation names the work; the short reference cannot, because
    // author-year strings collide - see the note on the table above.
    assert.ok(
      molecule.citation?.trim(),
      `${molecule.name} has no full bibliographic citation`,
    );
    assert.match(
      molecule.citation,
      /(1[89]|20)\d{2}/,
      `${molecule.name}'s citation states no year`,
    );

    // `null` is the honest value when no DOI could be resolved. What is not
    // allowed is a string that merely looks like one: a composed DOI resolves
    // to a real but different paper, which is the failure this guards.
    if (molecule.doi !== null) {
      assert.match(
        molecule.doi,
        /^10\.\d{4,9}\/\S+$/,
        `${molecule.name} has '${molecule.doi}', which is not a well-formed DOI`,
      );
    }

    // The curation rule above, enforced rather than merely described: a value
    // known only to within several kJ/mol cannot adjudicate a method whose own
    // error is 5.5, so admitting one would weaken the comparison silently.
    assert.ok(
      molecule.uncertainty === null || molecule.uncertainty <= MAX_UNCERTAINTY,
      `${molecule.name} carries an uncertainty of ${molecule.uncertainty} kJ/mol, above the ` +
      `${MAX_UNCERTAINTY} kJ/mol ceiling for an experimental value used here`,
    );
  }
});

test("no enthalpy sum draws on the cyclohexane A-values", () => {
  // The A-values are a conformational free energy, not an enthalpy of
  // formation. Adding one to a heat of formation is a category error that
  // arithmetic cannot see, and the interface deliberately puts those rows one
  // click away from the increments, so the mistake is easy to make.
  //
  // The two quantities allowed here are read from the manifest rather than
  // named as file numbers, so a sixth category of some third quantity is
  // refused on arrival instead of being silently summable.
  const ENTHALPY_QUANTITIES = new Set(["standard enthalpy of formation", "ring and steric correction"]);
  const quantities = new Map(categories.map((category) => [category.file, category.quantity]));

  for (const molecule of MOLECULES) {
    for (const [file] of molecule.groups) {
      const quantity = quantities.get(file);
      assert.ok(
        ENTHALPY_QUANTITIES.has(quantity),
        `${molecule.name} draws on ${file}, whose quantity is '${quantity}' - not an enthalpy contribution`,
      );
    }
  }
});
