/**
 * The molecules tools/thermochemistry.test.mjs compares with experiment, and the
 * citation behind every experimental value.
 *
 * They live apart from the test so that tools/build_doi_lock.mjs and
 * tools/doi_lock.test.mjs can read the citations without running it: importing a
 * test module registers and runs its tests.
 *
 * This module imports nothing. A reader of the citations should not break when
 * the way the increment data is loaded changes.
 */

const CH = "01_CH_Groups.csv";
const CHO = "02_CHO_Groups.csv";
const CHNO = "03_CHNO_Groups.csv";
const CORRECTIONS = "04_Corrections.csv";

/**
 * Every experimental value below was retrieved from the NIST Chemistry WebBook
 * in the session that wrote this file. Nothing here is recalled or estimated: a
 * remembered number would assert that a wrong value is right while looking
 * like verification, which is worse than having no test at all.
 *
 * Each entry carries four things, because a value needs to be both
 * attributable and retrievable and no single field is both:
 *
 *   `url`       the NIST page the value was read from, which shows the value
 *   `reference` the short form NIST prints, for finding the row on that page
 *   `citation`  authors, title, journal, year, volume, pages
 *   `doi`       a resolvable link to that work, or null with a `noDoiReason`
 *
 * A citation with a DOI also carries `work`: the parts of its own text that the
 * DOI's record is compared on - for an article, the type, title, the authors'
 * family names, year, volume and first page. tools/doi_lock.test.mjs refuses a
 * `work` field that cannot be read off the citation, so the two cannot drift.
 *
 * NIST's Comment column is part of the row, and it can change whose number a
 * value is: "Hf by ...", "see ...", "Reanalyzed by ..., Original value = ...".
 * Where a comment says more than a data-source code it is kept verbatim as
 * `nistComment`, and any work it names is cited as `commentCites`. The citation
 * test in tools/thermochemistry.test.mjs refuses a comment that names a work
 * without citing it.
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
 * molecule's own NIST page. Each DOI was found by search and accepted only after
 * an exact lookup of that DOI returned the same title, year, record type and
 * authors, and the same journal, volume and first page where the work has them -
 * so each is corroborated by two independent records rather than asserted from
 * one. A title alone proves nothing: the only records carrying the exact title
 * of Cox and Pilcher's 1970 monograph are reviews of it in two journals. No DOI
 * was composed by hand; a guessed suffix points at a real but different paper.
 * That lookup is now repeated rather than trusted: tools/build_doi_lock.mjs
 * records what each DOI resolves to in tools/doi_lock.json, and
 * tools/doi_lock.test.mjs compares every `work` with it.
 *
 * Where NIST and a DOI record disagree, the entry keeps what NIST prints and the
 * disagreement is recorded, not smoothed over. Where a registry writes a title
 * in a form that normalizing does not forgive - Pittam and Pilcher, Furuyama et
 * al., Ambrose et al., the WebBook - `work.registryTitle` holds the registry's
 * title exactly. Where a record lists names NIST does not - Pihlaja and
 * Heikkila - `work.registryExtraAuthors` holds them. Both are compared exactly,
 * so either fails the moment its record changes. Crossref also lists Baldt
 * before Hall, which is reported rather than failed, and names Springer
 * Netherlands rather than Chapman and Hall as the publisher of Pedley, Naylor
 * and Kirby 1986, which is not compared: see MUST_MATCH in tools/doi_lock.mjs.
 *
 * The two NIST compiled averages have no primary paper, so they cite the
 * database itself, whose own DOI resolves to it. Where no DOI could be found the
 * entry says `doi: null` and records why in `noDoiReason`, rather than carrying
 * a plausible guess.
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
export const MOLECULES = [
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
    work: {
      type: "journal-article",
      title:
        "Measurements of heats of combustion by flame calorimetry. Part 8. Methane, ethane, " +
        "propane, n-butane and 2-methylpropane",
      authors: ["Pittam", "Pilcher"],
      year: 1972,
      volume: "68",
      firstPage: "2224",
      // Crossref writes "Part 8.—Methane" where NIST prints "Part 8. Methane".
      registryTitle:
        "Measurements of heats of combustion by flame calorimetry. Part 8.—Methane, ethane, " +
        "propane, n-butane and 2-methylpropane",
    },
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
    work: {
      type: "journal-article",
      title:
        "Measurements of heats of combustion by flame calorimetry. Part 8. Methane, ethane, " +
        "propane, n-butane and 2-methylpropane",
      authors: ["Pittam", "Pilcher"],
      year: 1972,
      volume: "68",
      firstPage: "2224",
      // Crossref writes "Part 8.—Methane" where NIST prints "Part 8. Methane".
      registryTitle:
        "Measurements of heats of combustion by flame calorimetry. Part 8.—Methane, ethane, " +
        "propane, n-butane and 2-methylpropane",
    },
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
    work: {
      type: "journal-article",
      title: "The enthalpies of combustion and formation of the isomeric pentanes",
      authors: ["Good"],
      year: 1970,
      volume: "2",
      firstPage: "237",
    },
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
    work: {
      type: "journal-article",
      title: "Heats of combustion and formation of the paraffin hydrocarbons at 25 degrees C",
      authors: ["Prosen", "Rossini"],
      year: 1945,
      volume: "34",
      firstPage: "263",
    },
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
    work: {
      type: "journal-article",
      title: "Heats of combustion and formation of the paraffin hydrocarbons at 25 degrees C",
      authors: ["Prosen", "Rossini"],
      year: 1945,
      volume: "34",
      firstPage: "263",
    },
    nistComment: "see Prosen and Rossini, 1944; ALS",
    commentCites: {
      citation:
        "Prosen, E.J.; Rossini, F.D., 'Heats of combustion of eight normal paraffin hydrocarbons " +
        "in the liquid state', J. Res. NBS, 1944, 33, 255-272",
      doi: "10.6028/jres.033.011",
      work: {
        type: "journal-article",
        title: "Heats of combustion of eight normal paraffin hydrocarbons in the liquid state",
        authors: ["Prosen", "Rossini"],
        year: 1944,
        volume: "33",
        firstPage: "255",
      },
    },
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
    work: {
      type: "journal-article",
      title: "Heats of combustion and formation of cyclopropane",
      authors: ["Knowlton", "Rossini"],
      year: 1949,
      volume: "43",
      firstPage: "113",
    },
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
    work: {
      type: "journal-article",
      title:
        "Thermodynamics of cyclopentane, methylcyclopentane and 1,cis-3-dimethylcyclopentane: " +
        "Verification of the concept of pseudorotation",
      authors: ["McCullough", "Pennington", "Smith", "Hossenlopp", "Waddington"],
      year: 1959,
      volume: "81",
      firstPage: "5880",
    },
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
    work: {
      type: "journal-article",
      title:
        "Heats of formation and combustion of the normal alkylcyclopentanes and cyclohexanes and " +
        "the increment per CH2 group for several homologous series of hydrocarbons",
      authors: ["Prosen", "Johnson", "Rossini"],
      year: 1946,
      volume: "37",
      firstPage: "51",
    },
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C110827&Units=SI&Mask=1",
  },
  {
    // The two ring carbons beside the double bond each bond to a Cd, so they are
    // C-(Cd)(C)(H)2 - the group 1-butene below uses for the same kind of carbon -
    // and only the two carbons opposite the double bond are C-(C)2(H)2.
    name: "cyclohexene",
    groups: [
      [CH, "C-(C)2(H)2", 2], [CH, "C-(Cd)(C)(H)2", 2], [CH, "Cd-(C)(H)", 2],
      [CORRECTIONS, "cyclohexene", 1],
    ],
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
    work: {
      type: "journal-article",
      title:
        "Thermodynamic properties and ideal-gas enthalpies of formation for cyclohexene, " +
        "phthalan (2,5-dihydrobenzo-3,4-furan), isoxazole, octylamine, dioctylamine, " +
        "trioctylamine, phenyl isocyanate, and 1,4,5,6-tetrahydropyrimidine",
      authors: ["Steele", "Chirico", "Knipmeyer", "Nguyen", "Smith", "Tasker"],
      year: 1996,
      volume: "41",
      firstPage: "1269",
    },
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
    work: {
      type: "journal-article",
      title:
        "Thermochemistry of the gas phase equilibria i-C3H7I = C3H6 + HI, n-C3H7I = i-C3H7I, and " +
        "C3H6 + 2HI = C3H8 + I2",
      authors: ["Furuyama", "Golden", "Benson"],
      year: 1969,
      volume: "1",
      firstPage: "363",
      // Crossref's title has U+E5FB, a private-use character, where NIST prints each "=".
      registryTitle:
        "Thermochemistry of the gas phase equilibria i-C3H7I \uE5FB C3H6 + HI, n-C3H7I \uE5FB " +
        "i-C3H7I, and C3H6 + 2HI \uE5FB C3H8 + I2",
    },
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
    work: {
      type: "journal-article",
      title: "Heats of combustion, formation, and insomerization of ten C4 hydrocarbons",
      authors: ["Prosen", "Maron", "Rossini"],
      year: 1951,
      volume: "46",
      firstPage: "106",
    },
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
    work: {
      type: "journal-article",
      title: "Heats of combustion, formation, and insomerization of ten C4 hydrocarbons",
      authors: ["Prosen", "Maron", "Rossini"],
      year: 1951,
      volume: "46",
      firstPage: "106",
    },
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
    work: {
      type: "journal-article",
      title: "Critically Evaluated Thermochemical Properties of Polycyclic Aromatic Hydrocarbons",
      authors: ["Roux", "Temprado", "Chickos", "Nagano"],
      year: 2008,
      volume: "37",
      firstPage: "1855",
    },
    nistComment:
      "There are sufficient high-quality literature values to make a good evaluation with a " +
      "high degree of confidence. In general, the evaluated uncertainty limits are on the " +
      "order of (0.5 to 2.5) kJ/mol.; DRB",
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
    work: {
      type: "journal-article",
      title: "Critically Evaluated Thermochemical Properties of Polycyclic Aromatic Hydrocarbons",
      authors: ["Roux", "Temprado", "Chickos", "Nagano"],
      year: 2008,
      volume: "37",
      firstPage: "1855",
    },
    nistComment:
      "There are sufficient high-quality literature values to make a good evaluation with a " +
      "high degree of confidence. In general, the evaluated uncertainty limits are on the " +
      "order of (0.5 to 2.5) kJ/mol.; DRB",
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
    work: {
      type: "journal-article",
      title:
        "Heats of combustion of benzene, toluene, ethylbenzene, o-xylene, m-xylene, p-xylene, " +
        "n-propylbenzene, and styrene",
      authors: ["Prosen", "Gilmont", "Rossini"],
      year: 1945,
      volume: "34",
      firstPage: "65",
    },
    nistComment: "Hf by Prosen, Johnson, et al., 1946; ALS",
    commentCites: {
      citation:
        "Prosen, E.J.; Johnson, W.H.; Rossini, F.D., 'Heats of combustion and formation at 25 " +
        "degrees C of the alkylbenzenes through C10H14, and of the higher normal " +
        "monoalkylbenzenes', J. Res. NBS, 1946, 36, 455-461",
      doi: "10.6028/jres.036.025",
      work: {
        type: "journal-article",
        title:
          "Heats of combustion and formation at 25 degrees C of the alkylbenzenes through " +
          "C10H14, and of the higher normal monoalkylbenzenes",
        authors: ["Prosen", "Johnson", "Rossini"],
        year: 1946,
        volume: "36",
        firstPage: "455",
      },
    },
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
    work: {
      type: "journal-article",
      title:
        "Heats of combustion and formation at 25 degrees C of the alkylbenzenes through C10H14, " +
        "and of the higher normal monoalkylbenzenes",
      authors: ["Prosen", "Johnson", "Rossini"],
      year: 1946,
      volume: "36",
      firstPage: "455",
    },
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
    work: {
      type: "journal-article",
      title: "Heats of formation and combustion of 1,3-butadiene and styrene",
      authors: ["Prosen", "Rossini"],
      year: 1945,
      volume: "34",
      firstPage: "59",
    },
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C100425&Units=SI&Mask=1",
  },
  {
    name: "ethanol",
    groups: [[CH, "C-(C)(H)3", 1], [CHO, "C-(H)2(O)(C)", 1], [CHO, "O-(H)(C)", 1]],
    experimental: -234.0,
    uncertainty: 2.0,
    // NIST's own average of nine values; the page names no primary reference for
    // it, so the database itself is the cited work.
    method: "AVG",
    reference: "N/A",
    citation:
      "NIST Chemistry WebBook, NIST Standard Reference Database Number 69, National Institute " +
      "of Standards and Technology, Gaithersburg MD, last update 2025 - this compound page's " +
      "own average of the individual determinations it lists. NIST prints 'N/A' in the " +
      "Reference column for the averaged row, so the database itself is the cited work and " +
      "no primary paper is claimed",
    doi: "10.18434/T4D303",
    work: {
      type: "dataset",
      title: "NIST Chemistry WebBook, NIST Standard Reference Database Number 69",
      publisher: "National Institute of Standards and Technology",
      // NIST's DataCite record for the WebBook says "Database 69"; NIST's own citation
      // guide, like the citation here, says "Database Number 69".
      registryTitle: "NIST Chemistry WebBook, NIST Standard Reference Database 69",
    },
    nistComment: "Average of 9 values; Individual data points",
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
    work: {
      type: "journal-article",
      title: "Heats of combustion: diethyl ether and 1,1-diethoxyethane",
      authors: ["Pihlaja", "Heikkila"],
      year: 1968,
      volume: "22",
      firstPage: "2731",
      // Crossref lists two names beyond the two NIST cites. The journal's own page for
      // this article, where the DOI leads, names only Pihlaja and Heikkilä.
      registryExtraAuthors: ["Buchardt", "Norin"],
    },
    nistComment:
      "Reanalyzed by Pedley, Naylor, et al., 1986, Original value = -250.3 \u00b1 1.8 kJ/mol; ALS",
    // -252.7 is the reanalysed figure NIST lists, taken by the same rule as every
    // other row: the measurement is Pihlaja and Heikkila's, the number Pedley's.
    commentCites: {
      citation:
        "Pedley, J.B.; Naylor, R.D.; Kirby, S.P., 'Thermochemical Data of Organic Compounds', " +
        "Chapman and Hall, New York, 1986, 1-792",
      doi: "10.1007/978-94-009-4099-4",
      work: {
        type: "book",
        title: "Thermochemical Data of Organic Compounds",
        authors: ["Pedley", "Naylor", "Kirby"],
        year: 1986,
      },
    },
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
    work: {
      type: "journal-article",
      title:
        "Thermochemical studies of carbonyl compounds. 5. Enthalpies of reduction of carbonyl " +
        "groups",
      authors: ["Wiberg", "Crocker", "Morgan"],
      year: 1991,
      volume: "113",
      firstPage: "3447",
    },
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
    work: {
      type: "journal-article",
      title:
        "Thermochemical studies of carbonyl compounds. 5. Enthalpies of reduction of carbonyl " +
        "groups",
      authors: ["Wiberg", "Crocker", "Morgan"],
      year: 1991,
      volume: "113",
      firstPage: "3447",
    },
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C75070&Units=SI&Mask=1",
  },
  {
    name: "acetic acid",
    groups: [[CHO, "C-(H)3(CO)", 1], [CHO, "CO-(C)(O)", 1], [CHO, "O-(H)(CO)", 1]],
    experimental: -433.0,
    uncertainty: 3.0,
    method: "AVG",
    reference: "N/A",
    citation:
      "NIST Chemistry WebBook, NIST Standard Reference Database Number 69, National Institute " +
      "of Standards and Technology, Gaithersburg MD, last update 2025 - this compound page's " +
      "own average of the individual determinations it lists. NIST prints 'N/A' in the " +
      "Reference column for the averaged row, so the database itself is the cited work and " +
      "no primary paper is claimed",
    doi: "10.18434/T4D303",
    work: {
      type: "dataset",
      title: "NIST Chemistry WebBook, NIST Standard Reference Database Number 69",
      publisher: "National Institute of Standards and Technology",
      // NIST's DataCite record for the WebBook says "Database 69"; NIST's own citation
      // guide, like the citation here, says "Database Number 69".
      registryTitle: "NIST Chemistry WebBook, NIST Standard Reference Database 69",
    },
    nistComment: "Average of 8 values; Individual data points",
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
    work: {
      type: "journal-article",
      title: "Thermochemistry of strained-ring bridgehead nitriles and esters",
      authors: ["Hall", "Baldt"],
      year: 1971,
      volume: "93",
      firstPage: "140",
    },
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
    work: {
      type: "journal-article",
      title: "The heats of combustion of phenol and the three cresols",
      authors: ["Cox"],
      year: 1961,
      volume: "2",
      firstPage: "125",
    },
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
    work: {
      type: "journal-article",
      title:
        "Thermodynamic properties of organic oxygen compounds. 42. Physical and thermodynamic " +
        "properties of benzaldehyde",
      authors: ["Ambrose", "Connett", "Green", "Hales", "Head", "Martin"],
      year: 1975,
      volume: "7",
      firstPage: "1143",
      // Crossref's title has no full stop after "compounds".
      registryTitle:
        "Thermodynamic properties of organic oxygen compounds 42. Physical and thermodynamic " +
        "properties of benzaldehyde",
    },
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
    work: {
      type: "journal-article",
      title:
        "The second virial coefficients of pyridine and benzene, and certain of their methyl " +
        "homologues",
      authors: ["Andon", "Cox", "Herington", "Martin"],
      year: 1957,
      volume: "53",
      firstPage: "1074",
    },
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C110861&Units=SI&Mask=1",
  },
  {
    name: "trimethylamine",
    groups: [[CHNO, "C-(H)3(N)", 3], [CHNO, "N-(C)3", 1]],
    experimental: -23.7,
    uncertainty: 0.75,
    method: "Eqk",
    reference: "Issoire and Long, 1960",
    citation:
      "Issoire, J.; Long, C., 'Etude de la thermodynamique chimique de la reaction de formation " +
      "des methylamines', Bull. Soc. Chim. France, 1960, 2004-2012",
    doi: null,
    noDoiReason:
      "Crossref does not index this volume; its best bibliographic match was a 1984 encyclopedia " +
      "entry, so no DOI is claimed. The NIST page is the retrievable record.",
    nistComment: "Heat of formation derived by Cox and Pilcher, 1970; ALS",
    commentCites: {
      citation:
        "Cox, J.D.; Pilcher, G., 'Thermochemistry of Organic and Organometallic Compounds', " +
        "Academic Press, New York, 1970, 1-636",
      doi: null,
      noDoiReason:
        "Crossref has no record of the book. The only records carrying its title are reviews of " +
        "it in J. Organomet. Chem. and Ber. Bunsenges. Phys. Chem., which are not the book.",
    },
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
    work: {
      type: "journal-article",
      title: "Thermochemistry of strained-ring bridgehead nitriles and esters",
      authors: ["Hall", "Baldt"],
      year: 1971,
      volume: "93",
      firstPage: "140",
    },
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
    work: {
      type: "journal-article",
      title: "Chemical thermodynamic properties of aniline",
      authors: ["Hatton", "Hildenbrand", "Sinke", "Stull"],
      year: 1962,
      volume: "7",
      firstPage: "229",
    },
    url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C62533&Units=SI&Mask=1",
  },
];

/**
 * Every citation above as one list: each molecule's own, and the work its NIST
 * comment names where it has one. tools/build_doi_lock.mjs resolves the DOIs in
 * it, and tools/doi_lock.test.mjs checks each against what its DOI resolved to;
 * neither needs to know where a citation sits in a molecule entry.
 */
export const CITATIONS = MOLECULES.flatMap((molecule) => {
  const own = { citedBy: molecule.name, ...citationOf(molecule) };
  if (!molecule.commentCites) return [own];
  const named = `${molecule.name} (the work its NIST comment names)`;
  return [own, { citedBy: named, ...citationOf(molecule.commentCites) }];
});

function citationOf({ citation, doi, noDoiReason, work }) {
  return { citation, doi, noDoiReason, work };
}
