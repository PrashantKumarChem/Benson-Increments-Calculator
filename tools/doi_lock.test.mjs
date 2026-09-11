/**
 * Does every cited DOI resolve to the work its citation names?
 *
 * Offline. Each citation in tools/thermochemistry_data.mjs is compared with
 * tools/doi_lock.json, the record of what its DOI resolved to when
 * tools/build_doi_lock.mjs last ran. CI reruns that generator and fails if the
 * committed file differs, which is what stops the file from being edited to agree
 * with a wrong DOI. tools/doi_lock.mjs says what is compared, and what none of
 * this proves.
 *
 * The resolver tests hand resolveDoi a stand-in for fetch, so nothing in this
 * file touches the network.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CITATIONS } from "./thermochemistry_data.mjs";
import {
  LOCK_FILE,
  NotACitationRecord,
  ResolverUnreachable,
  USER_AGENT,
  checkCitation,
  lockEntryFor,
  normalizeTitle,
  resolveDoi,
  serializeLock,
} from "./doi_lock.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockText = await readFile(path.join(ROOT, LOCK_FILE), "utf8");
const { records } = JSON.parse(lockText);

// --- The citations, against the lock -------------------------------------------

for (const citation of CITATIONS.filter((candidate) => candidate.doi)) {
  test(`${citation.citedBy}: ${citation.doi} resolves to the work its citation names`, (t) => {
    const { problems, notes } = checkCitation(citation, records);
    // A disagreement that is not a failure - another author order, a registry's
    // acknowledged form of a title - is reported every run, never absorbed.
    for (const note of notes) t.diagnostic(note);
    assert.equal(problems.length, 0, problems.join("\n"));
  });
}

test("the lock holds a record for every cited DOI, and for nothing else", () => {
  const cited = new Set(CITATIONS.map((citation) => citation.doi).filter(Boolean));
  const locked = Object.keys(records);
  const unrecorded = [...cited].filter((doi) => !locked.includes(doi));
  const uncited = locked.filter((doi) => !cited.has(doi));

  assert.deepEqual(unrecorded, [], `cited, with no record in ${LOCK_FILE}: ${unrecorded.join(", ")}`);
  assert.deepEqual(uncited, [], `recorded in ${LOCK_FILE}, cited by nothing: ${uncited.join(", ")}`);
});

test("the lock file is laid out exactly as the generator writes it", () => {
  // Whether its contents are what the DOIs resolve to needs the network, and is
  // CI's check. Its layout does not: a record out of order or a CRLF from a hand
  // edit is caught here.
  assert.equal(lockText, serializeLock(records), `${LOCK_FILE} is not laid out as the generator writes it`);
});

test("every citation of one DOI is the same citation", () => {
  // The same work is cited from more than one molecule. If the copies drifted,
  // each could still match the record while saying different things.
  const first = new Map();
  for (const citation of CITATIONS.filter((candidate) => candidate.doi)) {
    const earlier = first.get(citation.doi);
    if (!earlier) {
      first.set(citation.doi, citation);
      continue;
    }
    const pair = `${citation.citedBy} and ${earlier.citedBy}`;
    assert.equal(citation.citation, earlier.citation, `${pair} cite ${citation.doi} differently`);
    assert.deepEqual(citation.work, earlier.work, `${pair} describe ${citation.doi}'s work differently`);
  }
});

// --- Comparing one citation with one record -------------------------------------

/** Every problem checkCitation finds, as one string, so a test can look for any of them. */
const problemsOf = (citation, locked) => checkCitation(citation, locked).problems.join("\n");

const HALL_BALDT = {
  citedBy: "methyl acetate",
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
};

/** As Crossref records ja00730a025: Baldt first. */
const A025 = {
  type: "journal-article",
  title: "Thermochemistry of strained-ring bridgehead nitriles and esters",
  authors: ["Baldt", "Hall"],
  year: 1971,
  volume: "93",
  page: "140-145",
};

/** As Crossref records ja00730a026, the neighbouring DOI. */
const A026 = {
  type: "journal-article",
  title: "Nature of the carbonium ion. VII. Dehydronorbornyl cations from thiocyanate isomerizations",
  authors: ["Spurlock", "Cox"],
  year: 1971,
  volume: "93",
  page: "146-151",
};

test("a neighbouring DOI is refused, naming who cites it, both titles and what differs", () => {
  const wrong = { ...HALL_BALDT, doi: "10.1021/ja00730a026" };
  const { problems } = checkCitation(wrong, { "10.1021/ja00730a026": A026 });

  assert.equal(problems.length, 1);
  const [problem] = problems;
  assert.match(problem, /^methyl acetate: 10\.1021\/ja00730a026 does not resolve to the work/);
  assert.match(problem, /cited: +'Thermochemistry of strained-ring bridgehead nitriles and esters'/);
  assert.match(problem, /resolves to: 'Nature of the carbonium ion\. VII\. Dehydronorbornyl cations/);
  assert.match(problem, /first page: cited 140, record 146-151/);
  // Journal, volume and year are shared, so they cannot be what refuses it.
  assert.doesNotMatch(problem, /- volume:|- year:/);
});

test("a review of a book never passes for the book", () => {
  // Pedley's review in J. Organomet. Chem. carries the monograph's title and its
  // year. Only the record type and the authors tell them apart.
  const coxPilcher = {
    citedBy: "trimethylamine (the work its NIST comment names)",
    citation:
      "Cox, J.D.; Pilcher, G., 'Thermochemistry of Organic and Organometallic Compounds', " +
      "Academic Press, New York, 1970, 1-636",
    doi: "10.1016/s0022-328x(00)92784-0",
    work: {
      type: "book",
      title: "Thermochemistry of Organic and Organometallic Compounds",
      authors: ["Cox", "Pilcher"],
      year: 1970,
    },
  };
  const review = {
    type: "journal-article",
    title: "Thermochemistry of organic and organometallic compounds",
    authors: ["Pedley"],
    year: 1970,
    volume: "23",
    page: "C14",
  };

  const { problems } = checkCitation(coxPilcher, { [coxPilcher.doi]: review });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /type: the citation names a book, and the record is a journal-article/);
  assert.match(problems[0], /authors: the record does not list Cox, Pilcher/);
  assert.doesNotMatch(problems[0], /- title:|- year:/);
});

test("authors are a set: another order is reported, a missing or extra name fails", () => {
  const result = checkCitation(HALL_BALDT, { [HALL_BALDT.doi]: A025 });
  assert.deepEqual(result.problems, []);
  assert.match(result.notes.join("\n"), /different order: cited Hall, Baldt; record Baldt, Hall/);

  const withoutHall = { ...A025, authors: ["Baldt"] };
  assert.match(problemsOf(HALL_BALDT, { [HALL_BALDT.doi]: withoutHall }), /the record does not list Hall/);

  const withNorin = { ...A025, authors: ["Baldt", "Hall", "Norin"] };
  assert.match(problemsOf(HALL_BALDT, { [HALL_BALDT.doi]: withNorin }), /also lists Norin, whom the citation/);

  // A diacritic NIST drops is the same name.
  const heikkila = {
    ...HALL_BALDT,
    citation: HALL_BALDT.citation.replace("Baldt, J.H.", "Heikkila, J."),
    work: { ...HALL_BALDT.work, authors: ["Hall", "Heikkila"] },
  };
  const withUmlaut = { ...A025, authors: ["Hall", "Heikkilä"] };
  assert.equal(problemsOf(heikkila, { [HALL_BALDT.doi]: withUmlaut }), "");
});

test("acknowledged extra names are reported, and fail once the record drops them", () => {
  const acknowledged = { ...HALL_BALDT, work: { ...HALL_BALDT.work, registryExtraAuthors: ["Norin"] } };
  const withNorin = { ...A025, authors: ["Baldt", "Hall", "Norin"] };

  const result = checkCitation(acknowledged, { [HALL_BALDT.doi]: withNorin });
  assert.deepEqual(result.problems, []);
  assert.match(result.notes.join("\n"), /also lists Norin, as acknowledged/);

  assert.match(problemsOf(acknowledged, { [HALL_BALDT.doi]: A025 }), /no longer on it: Norin/);
});

test("an acknowledged registry title is compared exactly, and goes stale when the record changes", () => {
  const cited =
    "Measurements of heats of combustion by flame calorimetry. Part 8. Methane, ethane, propane, " +
    "n-butane and 2-methylpropane";
  const registry = cited.replace("Part 8. Methane", "Part 8.—Methane");
  const pittam = {
    citedBy: "n-butane",
    citation: `Pittam, D.A.; Pilcher, G., '${cited}', J. Chem. Soc. Faraday Trans. 1, 1972, 68, 2224-2229`,
    doi: "10.1039/f19726802224",
    work: {
      type: "journal-article",
      title: cited,
      authors: ["Pittam", "Pilcher"],
      year: 1972,
      volume: "68",
      firstPage: "2224",
      registryTitle: registry,
    },
  };
  const entry = {
    type: "journal-article",
    title: registry,
    authors: ["Pittam", "Pilcher"],
    year: 1972,
    volume: "68",
    page: "2224",
  };

  const result = checkCitation(pittam, { [pittam.doi]: entry });
  assert.deepEqual(result.problems, []);
  assert.match(result.notes.join("\n"), /writes the title differently, as acknowledged/);

  // Without the acknowledgement the difference fails: normalizing does not absorb it.
  const { registryTitle, ...unacknowledged } = pittam.work;
  assert.match(problemsOf({ ...pittam, work: unacknowledged }, { [pittam.doi]: entry }), /- title: cited/);

  // The registry corrects its title to NIST's form: the acknowledgement is stale.
  assert.match(problemsOf(pittam, { [pittam.doi]: { ...entry, title: cited } }), /title was acknowledged as/);

  // An acknowledgement of a difference normalizing already forgives is refused.
  const needless = { ...pittam, work: { ...pittam.work, registryTitle: `${cited}.` } };
  const recordWithStop = { [pittam.doi]: { ...entry, title: `${cited}.` } };
  assert.match(problemsOf(needless, recordWithStop), /acknowledges no difference/);
});

test("a dataset is compared on its type, title and publisher", () => {
  const webbook = {
    citedBy: "ethanol",
    citation:
      "NIST Chemistry WebBook, NIST Standard Reference Database Number 69, National Institute " +
      "of Standards and Technology, Gaithersburg MD, last update 2025",
    doi: "10.18434/T4D303",
    work: {
      type: "dataset",
      title: "NIST Chemistry WebBook, NIST Standard Reference Database Number 69",
      publisher: "National Institute of Standards and Technology",
      registryTitle: "NIST Chemistry WebBook, NIST Standard Reference Database 69",
    },
  };
  const entry = {
    type: "dataset",
    title: "NIST Chemistry WebBook, NIST Standard Reference Database 69",
    publisher: "National Institute of Standards and Technology",
  };
  const against = (changes) => problemsOf(webbook, { [webbook.doi]: { ...entry, ...changes } });

  assert.equal(against({}), "");
  assert.match(against({ publisher: "Another Institute" }), /- publisher: cited/);
  assert.match(against({ type: "journal-article" }), /- type:/);
});

test("work fields must be read off the citation, so they cannot be edited to fit a wrong DOI", () => {
  const retitled = { ...HALL_BALDT, work: { ...HALL_BALDT.work, title: A026.title } };
  const retitledProblems = problemsOf(retitled, { [HALL_BALDT.doi]: A026 });
  assert.match(retitledProblems, /work\.title '.*' is not the title in its citation/);

  const repaged = { ...HALL_BALDT, work: { ...HALL_BALDT.work, firstPage: "146" } };
  assert.match(problemsOf(repaged, {}), /are not the year, volume and first page its citation ends with/);

  const reauthored = { ...HALL_BALDT, work: { ...HALL_BALDT.work, authors: ["Spurlock", "Cox"] } };
  assert.match(problemsOf(reauthored, {}), /names Spurlock, who is not an author in its citation/);
});

test("a citation with a DOI says which work it means, and does not also claim to have none", () => {
  const { work, ...bare } = HALL_BALDT;
  assert.match(problemsOf(bare, {}), /no `work` fields/);

  const both = { ...HALL_BALDT, noDoiReason: "none could be found" };
  assert.match(problemsOf(both, { [HALL_BALDT.doi]: A025 }), /also a reason for having no DOI/);

  const unruled = { ...HALL_BALDT, work: { ...HALL_BALDT.work, type: "report" } };
  assert.match(problemsOf(unruled, {}), /nothing says what has to match for a 'report'/);

  assert.match(
    problemsOf(HALL_BALDT, {}),
    /tools\/doi_lock\.json has no record of 10\.1021\/ja00730a025\. Run: node tools\/build_doi_lock\.mjs/,
  );
});

// --- Normalizing a title ----------------------------------------------------------

test("titles that differ only in form normalize to the same string", () => {
  const pairs = [
    ["Chemical Thermodynamic Properties of Aniline.", "Chemical thermodynamic properties of aniline"],
    ["Journal of Chemical &amp; Engineering Data", "Journal of Chemical & Engineering Data"],
    [
      "Thermodynamics of 1,<i>cis</i>-3-Dimethylcyclopentane",
      "Thermodynamics of 1,cis-3-dimethylcyclopentane",
    ],
    ["Étude de la thermodynamique chimique", "Etude de la thermodynamique chimique"],
    ["at 25 °C", "at 25 degrees C"],
    ["pages 1\u20132", "pages 1-2"],
    ["the \u2018quoted\u2019 word", "the 'quoted' word"],
    ["two  spaces", "two spaces"],
  ];
  for (const [a, b] of pairs) assert.equal(normalizeTitle(a), normalizeTitle(b), `'${a}' / '${b}'`);
});

test("normalizing keeps apart titles that differ in anything but form", () => {
  const pairs = [
    // The neighbouring DOIs from the review: same journal, volume and year.
    ["Thermochemistry of strained-ring bridgehead nitriles and esters", A026.title],
    // Prosen and Rossini 1945 is two papers, and so is Prosen, Johnson et al. 1946.
    [
      "Heats of combustion and formation of the paraffin hydrocarbons at 25 degrees C",
      "Heats of formation and combustion of 1,3-butadiene and styrene",
    ],
    [
      "Heats of formation and combustion of the normal alkylcyclopentanes and cyclohexanes and the " +
      "increment per CH2 group for several homologous series of hydrocarbons",
      "Heats of combustion and formation at 25 degrees C of the alkylbenzenes through C10H14, and " +
      "of the higher normal monoalkylbenzenes",
    ],
    // Signs, locants, formulae, numbers and series numerals are all kept.
    ["(+)-camphor", "(-)-camphor"],
    ["1,3-pentadiene", "1,4-pentadiene"],
    ["C3H6", "C3H8"],
    ["at 25 degrees C", "at 35 degrees C"],
    ["Part 8", "Part 9"],
    ["Nature of the carbonium ion. VII", "Nature of the carbonium ion. VIII"],
    ["cm²", "cm2"],
    // The four places a registry writes a cited title differently. Normalizing
    // does not absorb any of them; each citation acknowledges its registry's title.
    ["Part 8.—Methane", "Part 8. Methane"],
    ["i-C3H7I \uE5FB C3H6 + HI", "i-C3H7I = C3H6 + HI"],
    ["organic oxygen compounds 42.", "organic oxygen compounds. 42."],
    ["NIST Standard Reference Database 69", "NIST Standard Reference Database Number 69"],
  ];
  for (const [a, b] of pairs) {
    assert.notEqual(normalizeTitle(a), normalizeTitle(b), `'${a}' and '${b}' normalized alike`);
  }
});

test("folding case makes CO and Co the same word - the stated cost of comparing without case", () => {
  // NIST and the registries capitalize titles differently in several citations
  // here, so case has to go. Pinned, so that the cost is known rather than found.
  // The authors, year, volume and first page are what keep two such works apart.
  const carbonMonoxide = normalizeTitle("Thermochemistry of CO complexes");
  assert.equal(carbonMonoxide, normalizeTitle("Thermochemistry of Co complexes"));
});

// --- What the lock keeps from a record ------------------------------------------

/** Crossref's record for ja00730a025, trimmed, with its self-changing fields. */
const CROSSREF_A025 = {
  indexed: { "date-parts": [[2026, 9, 4]], "date-time": "2026-09-04T23:04:02Z", timestamp: 1788563042553 },
  "reference-count": 0,
  publisher: "American Chemical Society (ACS)",
  issue: "1",
  DOI: "10.1021/ja00730a025",
  type: "journal-article",
  page: "140-145",
  "is-referenced-by-count": 76,
  title: "Thermochemistry of strained-ring bridgehead nitriles and esters",
  volume: "93",
  author: [
    { given: "J. H.", family: "Baldt", sequence: "first" },
    { suffix: "Jr.", given: "Henry Kingston K.", family: "Hall", sequence: "additional" },
  ],
  "container-title": "Journal of the American Chemical Society",
  deposited: { "date-parts": [[2023, 3, 31]] },
  score: 1,
  issued: { "date-parts": [[1971, 1]] },
};

test("fields that change on their own never reach the lock", () => {
  const later = {
    ...CROSSREF_A025,
    indexed: { "date-parts": [[2027, 2, 1]], "date-time": "2027-02-01T00:00:00Z", timestamp: 1801440000000 },
    deposited: { "date-parts": [[2027, 1, 30]] },
    "is-referenced-by-count": 103,
    "reference-count": 12,
    score: 17.4,
    publisher: "American Chemical Society",
    "container-title": "J. Am. Chem. Soc.",
    link: [{ URL: "https://pubs.acs.org/doi/pdf/10.1021/ja00730a025" }],
  };
  assert.equal(
    serializeLock({ [CROSSREF_A025.DOI]: lockEntryFor(later) }),
    serializeLock({ [CROSSREF_A025.DOI]: lockEntryFor(CROSSREF_A025) }),
  );
  assert.deepEqual(lockEntryFor(CROSSREF_A025), A025);
});

test("a character nobody can see is written into the lock as an escape, and reads back unchanged", () => {
  const entries = {
    "10.1016/0021-9614(69)90066-4": {
      type: "journal-article",
      title: "Thermochemistry of the gas phase equilibria i-C3H7I \uE5FB C3H6 + HI",
      authors: ["Furuyama"],
      year: 1969,
      volume: "1",
      page: "363-375",
    },
    // Outside the Basic Multilingual Plane, one character is two UTF-16 units, and
    // escaping only the first would write half a surrogate pair.
    "10.0000/plane-15": { type: "dataset", title: "private use, plane 15: \u{F0000}", publisher: "none" },
  };
  const text = serializeLock(entries);

  assert.match(text, /i-C3H7I \\uE5FB C3H6/);
  assert.match(text, /plane 15: \\uDB80\\uDC00/);
  assert.doesNotMatch(text, /[\uE000-\uF8FF]|[\u{F0000}-\u{FFFFD}]/u);
  assert.deepEqual(JSON.parse(text).records, entries);
});

test("a dataset's lock entry keeps only what a dataset is compared on", () => {
  const webbook = {
    type: "dataset",
    id: "https://doi.org/10.18434/t4d303",
    author: [{ family: "Linstrom", given: "Peter" }],
    issued: { "date-parts": [[1997]] },
    DOI: "10.18434/T4D303",
    publisher: "National Institute of Standards and Technology",
    title: "NIST Chemistry WebBook, NIST Standard Reference Database 69",
  };
  const entry = lockEntryFor(webbook);
  assert.deepEqual(entry, { type: "dataset", title: webbook.title, publisher: webbook.publisher });
  // A new release may move the record's year or add a name; neither reaches the lock.
  assert.deepEqual(lockEntryFor({ ...webbook, issued: { "date-parts": [[2026]] }, author: [] }), entry);
});

// --- Asking the resolver ----------------------------------------------------------

function standIn(...answers) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { fetch, calls };
}

const cslResponse = (record) =>
  new Response(JSON.stringify(record), {
    status: 200,
    headers: { "content-type": "application/vnd.citationstyles.csl+json" },
  });
const noWait = async () => {};

test("an unreachable resolver fails, and says the resolver could not be reached", async () => {
  const offline = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
  const { fetch, calls } = standIn(offline, offline, offline, offline, offline);

  await assert.rejects(resolveDoi("10.1021/ja00730a025", { fetch, sleep: noWait }), (error) => {
    assert.ok(error instanceof ResolverUnreachable, `expected ResolverUnreachable, got ${error.name}`);
    assert.match(error.message, /^The DOI resolver could not be reached for 10\.1021\/ja00730a025/);
    assert.match(error.message, /5 attempts, the last failing with .*fetch failed \(ENOTFOUND\)/);
    return true;
  });
  assert.equal(calls.length, 5);
});

test("a resolver that only ever answers 503 could not be reached either", async () => {
  const { fetch } = standIn(...Array.from({ length: 5 }, () => new Response("down", { status: 503 })));
  await assert.rejects(resolveDoi("10.1021/ja00730a025", { fetch, sleep: noWait }), ResolverUnreachable);
});

test("rate limits and server errors are retried with a growing wait, honouring Retry-After", async () => {
  const waits = [];
  const sleep = async (ms) => {
    waits.push(ms);
  };
  const { fetch, calls } = standIn(
    new Response("slow down", { status: 429, headers: { "retry-after": "3" } }),
    new Response("unavailable", { status: 503 }),
    cslResponse(CROSSREF_A025),
  );

  const record = await resolveDoi("10.1021/ja00730a025", { fetch, sleep });
  assert.equal(record.title, CROSSREF_A025.title);
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [3000, 2000]);
});

test("the request asks doi.org for CSL JSON, and names the repository rather than a person", async () => {
  const { fetch, calls } = standIn(cslResponse(CROSSREF_A025));
  await resolveDoi("10.1021/ja00730a025", { fetch, sleep: noWait });

  assert.equal(calls[0].url, "https://doi.org/10.1021/ja00730a025");
  assert.equal(calls[0].options.headers.Accept, "application/vnd.citationstyles.csl+json");
  assert.equal(calls[0].options.headers["User-Agent"], USER_AGENT);
  assert.match(USER_AGENT, /github\.com\/PrashantKumarChem\/Benson-Increments-Calculator/);
  assert.doesNotMatch(USER_AGENT, /@/);
});

test("an answer that is not a record for this DOI fails at once, saying what came back", async () => {
  let stand = standIn(new Response("", { status: 404 }));
  await assert.rejects(resolveDoi("10.1021/ja00730a999", { fetch: stand.fetch, sleep: noWait }), (error) => {
    assert.ok(error instanceof NotACitationRecord);
    assert.match(error.message, /doi\.org has no record of 10\.1021\/ja00730a999/);
    return true;
  });
  assert.equal(stand.calls.length, 1);

  stand = standIn(new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }));
  await assert.rejects(
    resolveDoi("10.1021/ja00730a025", { fetch: stand.fetch, sleep: noWait }),
    /did not resolve to citation metadata: https:\/\/doi\.org\/10\.1021\/ja00730a025 sent text\/html/,
  );

  stand = standIn(cslResponse({ ...CROSSREF_A025, DOI: "10.1021/ja00730a026" }));
  await assert.rejects(
    resolveDoi("10.1021/ja00730a025", { fetch: stand.fetch, sleep: noWait }),
    /answered 10\.1021\/ja00730a025 with the record for 10\.1021\/ja00730a026/,
  );
});
