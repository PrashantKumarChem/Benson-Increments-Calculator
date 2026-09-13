/**
 * Whether each cited DOI resolves to the work its citation names.
 *
 * tools/thermochemistry.test.mjs compares the calculator with published values,
 * and every value carries a citation with a DOI. A check on a DOI's shape cannot
 * tell a wrong DOI from a right one, and a wrong one usually resolves to a real
 * paper: 10.1021/ja00730a025 is Hall and Baldt's paper on bridgehead nitriles and
 * esters, and 10.1021/ja00730a026 is a paper on carbonium ions in the same
 * journal, volume and year. Only resolving the DOI shows the difference.
 *
 * Resolving needs the network, and the unit tests must not, so the work is in
 * three parts - the bargain CI already strikes for the manifest and the asset
 * version:
 *
 *   tools/build_doi_lock.mjs   asks doi.org about every cited DOI and writes the
 *                              fields compared here to tools/doi_lock.json
 *   tools/doi_lock.test.mjs    compares every citation with that file, offline
 *   CI                         reruns the generator and fails on any difference
 *
 * A wrong DOI then disagrees with the committed file, and a committed file edited
 * to agree with a wrong DOI disagrees with what the DOI resolves to.
 *
 * What this does not prove. It shows that each DOI resolves to the work its
 * citation names. It does not show that the number came from that work, that the
 * right row of a NIST page was taken, or that a molecule's decomposition is right.
 * Those are the kinds of error review has actually found in this data, and no DOI
 * check could have caught one of them.
 */

export const LOCK_FILE = "tools/doi_lock.json";
export const GENERATOR = "node tools/build_doi_lock.mjs";

const RESOLVER = "https://doi.org/";
/**
 * Asking doi.org for CSL JSON is an exact lookup of the DOI, answered by
 * whichever registry holds it - Crossref for the journals here, DataCite for the
 * NIST WebBook. A registry's search endpoint is not: it returns a best guess, and
 * its top hit for one of these references was a 1984 encyclopedia entry.
 */
const ACCEPT = "application/vnd.citationstyles.csl+json";
/**
 * Registries ask callers to say who they are. The repository is the honest
 * answer; a person's address does not belong in a public repository's requests.
 */
export const USER_AGENT =
  "Benson-Increments-Calculator DOI lock " +
  "(+https://github.com/PrashantKumarChem/Benson-Increments-Calculator)";

/**
 * What has to agree for a DOI record to be the cited work, by the type the
 * citation names. The type itself always has to agree.
 *
 * Title and first page are what tell neighbouring papers apart: ja00730a025 and
 * ja00730a026 share a journal, a volume and a year. Type and authors are what
 * tell a book from a review of it: the only records carrying the title of Cox and
 * Pilcher's 1970 monograph are reviews, typed journal-article and written by
 * someone else, and a title-and-year comparison once accepted one.
 *
 * Authors are compared as a set of family names, because two records of one
 * paper can list them in a different order - Crossref puts Baldt before Hall.
 * A different order is reported, never failed.
 *
 * The journal is not compared. NIST abbreviates it, and the registries spell it
 * out or abbreviate it their own way, so comparing it would take a table of
 * abbreviations nobody could check - and title and first page already pin the
 * paper down.
 *
 * A book's publisher is not compared. A DOI record names whoever registered the
 * DOI: Pedley, Naylor and Kirby 1986 is Chapman and Hall on NIST and Springer
 * Netherlands on its DOI record, with title, authors, year and type agreeing.
 *
 * A dataset's publisher is compared, because a dataset has little else. The NIST
 * WebBook's DataCite record carries no page, volume or journal. Its year is not
 * compared either: the record says 1997, when the DOI was registered, and the
 * citation records the data's last update, 2025 - two different dates. Nor are
 * its authors: the citation names the institution, and the record one person.
 */
export const MUST_MATCH = {
  "journal-article": ["title", "authors", "year", "volume", "firstPage"],
  book: ["title", "authors", "year"],
  dataset: ["title", "publisher"],
};

/**
 * A title reduced to what two records of one work reliably agree on.
 *
 * Two titles normalize to the same string only if they differ in nothing but
 * letter case, markup such as <i>, character entities such as &amp;, diacritics,
 * which dash or quotation-mark glyph is used, "°" against "degrees", runs of
 * whitespace, or one final full stop. Each of those separates NIST's form of a
 * title from a registry's somewhere in the citations here.
 *
 * Folding case has a cost, stated rather than hidden: "CO" and "Co" become the
 * same word. Nothing else is discarded - no punctuation, no sign, no separator -
 * so "(+)" and "(-)" stay apart, and so do "Part 8. Methane" and "Part 8.—Methane".
 * Where a registry's title differs from the cited one by more than this list, the
 * citation records the registry's title as `registryTitle`, compared exactly,
 * rather than this function growing until it forgives a different paper.
 */
export function normalizeTitle(title) {
  return String(title)
    // Markup before entities, so that a decoded "&lt;" is never taken for a tag.
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, decodeEntity)
    // Canonical decomposition only. The compatibility forms would also fold "²"
    // into "2", which is a difference this list does not admit to discarding.
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    // Hyphens, dashes and the minus sign; single quotation marks; double; the degree sign.
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u00B0/g, " degrees ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");
}

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntity(match, body) {
  const lower = body.toLowerCase();
  if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
  if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
  return NAMED_ENTITIES[lower];
}

/** A family name as two records agree on it: NIST writes Heikkila, Crossref Heikkilä. */
export function nameKey(name) {
  return String(name).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function firstPageOf(page) {
  return page === null || page === undefined ? null : String(page).split(/[-\u2013]/)[0].trim();
}

/**
 * The part of a registry's record that the lock keeps.
 *
 * Only the fields compared above, and only for the record types that compare
 * them. A record also carries fields that change on their own - `indexed`,
 * `deposited`, `is-referenced-by-count`, `score` - and one record here had been
 * re-indexed days before it was first read. A lock holding those would fail CI
 * with nothing wrong. So would a dataset's year or authors, which a database's
 * record may update with a release, and a journal's publisher name, which a
 * registry may restyle; none of them is compared, so none is kept.
 *
 * Values are kept as the registry gives them. Normalizing happens when comparing,
 * so the lock stays a faithful record a reviewer can check against doi.org.
 */
export function lockEntryFor(record) {
  const title = Array.isArray(record.title) ? (record.title[0] ?? null) : (record.title ?? null);
  if (record.type === "dataset") {
    return { type: record.type, title, publisher: record.publisher ?? null };
  }
  return {
    type: record.type ?? null,
    title,
    authors: (record.author ?? []).map(
      (person) => person.family ?? person.literal ?? person.name ?? null,
    ),
    year: record.issued?.["date-parts"]?.[0]?.[0] ?? null,
    volume: record.volume ?? null,
    page: record.page ?? null,
  };
}

/**
 * The lock file's text: records in DOI order, two-space indent, LF, final newline.
 *
 * A character nobody can see is written as a \u escape. One registry title here
 * holds U+E5FB, a private-use character, where NIST prints "=", and written raw it
 * reads as a second space - which is what it was first taken for.
 */
export function serializeLock(records) {
  const sorted = Object.fromEntries(Object.keys(records).sort().map((doi) => [doi, records[doi]]));
  const text = JSON.stringify({ generatedBy: GENERATOR, records: sorted }, null, 2);
  return `${escapeInvisible(text)}\n`;
}

/**
 * Private-use, format and non-ASCII space characters as \u escapes, which JSON
 * reads back unchanged. One escape per UTF-16 unit, so a character outside the
 * Basic Multilingual Plane becomes a surrogate pair rather than half of one.
 */
export function escapeInvisible(text) {
  const unit = (character, i) => `\\u${character.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0")}`;
  return text.replace(/(?! )[\p{Co}\p{Cf}\p{Z}]/gu, (character) =>
    Array.from({ length: character.length }, (_, i) => unit(character, i)).join(""));
}

/** The resolver could not be asked, or would not answer: nothing about the DOI is known. */
export class ResolverUnreachable extends Error {
  name = "ResolverUnreachable";
}

/** The resolver answered, and the answer is not a citation record for this DOI. */
export class NotACitationRecord extends Error {
  name = "NotACitationRecord";
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The registry's record for one DOI.
 *
 * A dropped connection, a timeout, HTTP 429 and any 5xx are retried with a
 * growing wait, because Crossref has answered 429 to light load. Anything else
 * that is not a record for this DOI fails at once and says what came back.
 * When the retries run out, the error says the resolver could not be reached -
 * an outage must never read as a DOI that checked out.
 */
export async function resolveDoi(
  doi,
  { fetch = globalThis.fetch, sleep = pause, attempts = 5, timeoutMs = 30_000 } = {},
) {
  const url = RESOLVER + doi.split("/").map(encodeURIComponent).join("/");
  let lastFailure = "";
  let wait = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (wait) await sleep(wait);

    let response;
    let body;
    try {
      response = await fetch(url, {
        headers: { Accept: ACCEPT, "User-Agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      body = await response.text();
    } catch (error) {
      lastFailure = describeError(error);
      wait = backoff(attempt);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      lastFailure = `HTTP ${response.status}`;
      wait = retryAfter(response) ?? backoff(attempt);
      continue;
    }
    if (response.status === 404) throw new NotACitationRecord(`doi.org has no record of ${doi}`);
    if (!response.ok) throw new NotACitationRecord(`doi.org answered ${doi} with HTTP ${response.status}`);

    const contentType = response.headers.get("content-type") ?? "";
    let record;
    try {
      if (!/json/i.test(contentType)) throw new Error(contentType);
      record = JSON.parse(body);
    } catch {
      throw new NotACitationRecord(
        `${doi} did not resolve to citation metadata: ` +
        `${response.url || url} sent ${contentType || "no content type"}`,
      );
    }
    if (String(record.DOI ?? "").toLowerCase() !== doi.toLowerCase()) {
      throw new NotACitationRecord(
        `doi.org answered ${doi} with the record for ${record.DOI ?? "no DOI at all"}`,
      );
    }
    return record;
  }

  throw new ResolverUnreachable(
    `The DOI resolver could not be reached for ${doi}: ` +
    `${attempts} attempts, the last failing with ${lastFailure}.`,
  );
}

function backoff(attempt) {
  return 1000 * 2 ** (attempt - 1);
}

function retryAfter(response) {
  const header = response.headers.get("retry-after");
  if (header === null || header.trim() === "") return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds, 60) * 1000 : null;
}

function describeError(error) {
  const code = error?.cause?.code;
  return `${error?.name ?? "Error"}: ${error?.message ?? error}${code ? ` (${code})` : ""}`;
}

/**
 * Everything wrong with one citation's DOI, and anything worth saying that is
 * not wrong.
 *
 * `citation` is `{ citedBy, citation, doi, noDoiReason, work }`, where `work` holds
 * the parts of the citation text that a record is compared on. `records` is the
 * lock's `records` object. Problems fail the check; notes are reported and do not.
 */
export function checkCitation(citation, records) {
  const problems = [];
  const notes = [];
  const { citedBy, doi, work } = citation;
  const done = () => ({
    problems: problems.map((problem) => `${citedBy}: ${problem}`),
    notes: notes.map((note) => `${citedBy}: ${note}`),
  });

  if (citation.noDoiReason) problems.push(`it gives the DOI ${doi} and also a reason for having no DOI`);
  if (!work) {
    problems.push(`it has the DOI ${doi} but no \`work\` fields, so nothing says which work that DOI is`);
    return done();
  }
  const fields = MUST_MATCH[work.type];
  if (!fields) {
    problems.push(
      `nothing says what has to match for a '${work.type}'. ` +
      "Add it to MUST_MATCH in tools/doi_lock.mjs, and write down why",
    );
    return done();
  }
  problems.push(...unreadFields(String(citation.citation ?? ""), work, fields));

  const entry = records[doi];
  if (!entry) {
    problems.push(`${LOCK_FILE} has no record of ${doi}. Run: ${GENERATOR}`);
    return done();
  }

  const disagreements = [];
  if (entry.type !== work.type) {
    disagreements.push(`type: the citation names a ${work.type}, and the record is a ${entry.type}`);
  }
  if (fields.includes("title")) compareTitle(work, entry, disagreements, notes);
  if (fields.includes("authors")) compareAuthors(work, entry, disagreements, notes);
  if (fields.includes("year") && entry.year !== work.year) {
    disagreements.push(`year: cited ${work.year}, record ${entry.year ?? "none"}`);
  }
  if (fields.includes("volume") && entry.volume !== work.volume) {
    disagreements.push(`volume: cited ${work.volume}, record ${entry.volume ?? "none"}`);
  }
  if (fields.includes("firstPage") && firstPageOf(entry.page) !== work.firstPage) {
    disagreements.push(`first page: cited ${work.firstPage}, record ${entry.page ?? "none"}`);
  }
  if (fields.includes("publisher")) {
    if (normalizeTitle(entry.publisher ?? "") !== normalizeTitle(work.publisher)) {
      disagreements.push(`publisher: cited '${work.publisher}', record '${entry.publisher ?? "none"}'`);
    }
  }

  if (disagreements.length) {
    problems.push(
      `${doi} does not resolve to the work its citation names.\n` +
      `      cited:       ${describe(work)}\n` +
      `      resolves to: ${describe(entry)}\n` +
      disagreements.map((line) => `      - ${line}`).join("\n"),
    );
  }
  return done();
}

/**
 * Each compared field has to be read off the citation text itself. Otherwise
 * `work` could be edited on its own to agree with a wrong DOI while the citation
 * still names the right paper, and the check would pass.
 */
function unreadFields(text, work, fields) {
  const problems = [];
  for (const field of fields) {
    if (!isPresent(field, work[field])) {
      problems.push(`work.${field} is missing or malformed; a ${work.type} is compared on ${fields.join(", ")}`);
    }
  }
  if (problems.length) return problems;

  const quoted = work.type === "dataset" ? work.title : `'${work.title}'`;
  const at = text.indexOf(quoted);
  if (at < 0) return [`work.title '${work.title}' is not the title in its citation`];
  const before = text.slice(0, at);
  const after = text.slice(at + quoted.length);

  if (fields.includes("authors")) {
    for (const author of work.authors) {
      if (!before.includes(author)) {
        problems.push(`work.authors names ${author}, who is not an author in its citation`);
      }
    }
  }
  if (work.type === "journal-article") {
    const [year, volume, page] = [String(work.year), work.volume, work.firstPage].map(escapeRegExp);
    if (!new RegExp(`, ${year}, ${volume}, ${page}(-[0-9A-Za-z]+)?$`).test(after)) {
      problems.push(
        `work.year, work.volume and work.firstPage (${work.year}, ${work.volume}, ${work.firstPage}) ` +
        "are not the year, volume and first page its citation ends with",
      );
    }
  } else if (fields.includes("year") && !new RegExp(`, ${escapeRegExp(String(work.year))}(,|$)`).test(after)) {
    problems.push(`work.year ${work.year} is not the year in its citation`);
  }
  if (fields.includes("publisher") && !after.includes(work.publisher)) {
    problems.push(`work.publisher '${work.publisher}' is not in its citation`);
  }
  if (work.registryTitle !== undefined && normalizeTitle(work.registryTitle) === normalizeTitle(work.title)) {
    problems.push(
      "work.registryTitle normalizes to the cited title, so it acknowledges no difference - remove it",
    );
  }
  return problems;
}

function isPresent(field, value) {
  if (field === "authors") {
    return Array.isArray(value) && value.length > 0
      && value.every((name) => typeof name === "string" && name.trim() !== "");
  }
  if (field === "year") return Number.isInteger(value);
  return typeof value === "string" && value.trim() !== "";
}

function compareTitle(work, entry, disagreements, notes) {
  if (work.registryTitle === undefined) {
    if (normalizeTitle(entry.title ?? "") !== normalizeTitle(work.title)) {
      disagreements.push(`title: cited '${work.title}', record '${entry.title ?? "none"}'`);
    }
    return;
  }
  // Compared exactly, so an acknowledgement goes stale - and red - the moment the
  // record changes, including when a registry corrects its title to agree.
  if (entry.title !== work.registryTitle) {
    disagreements.push(
      `title: the registry's title was acknowledged as '${work.registryTitle}', ` +
      `and the record says '${entry.title ?? "none"}'`,
    );
  } else {
    notes.push(
      "the registry writes the title differently, as acknowledged: " +
      `cited '${work.title}', record '${entry.title}'`,
    );
  }
}

function compareAuthors(work, entry, disagreements, notes) {
  const recordNames = (entry.authors ?? []).map((name) => name ?? "");
  const cited = work.authors.map(nameKey);
  const recorded = recordNames.map(nameKey);
  const acknowledged = (work.registryExtraAuthors ?? []).map(nameKey);

  const missing = work.authors.filter((name) => !recorded.includes(nameKey(name)));
  const extra = recordNames.filter((name) => !cited.includes(nameKey(name)));
  const unacknowledged = extra.filter((name) => !acknowledged.includes(nameKey(name)));
  const extraKeys = extra.map(nameKey);
  const stale = (work.registryExtraAuthors ?? []).filter((name) => !extraKeys.includes(nameKey(name)));

  if (missing.length) {
    const listed = recordNames.join(", ") || "no one";
    disagreements.push(`authors: the record does not list ${missing.join(", ")} (it lists ${listed})`);
  }
  if (unacknowledged.length) {
    disagreements.push(
      `authors: the record also lists ${unacknowledged.join(", ")}, whom the citation does not name`,
    );
  }
  if (stale.length) {
    disagreements.push(
      `authors: acknowledged as extra names on the record, and no longer on it: ${stale.join(", ")}`,
    );
  }
  if (!missing.length && extra.length && !unacknowledged.length) {
    notes.push(
      `the record also lists ${extra.join(", ")}, as acknowledged; ` +
      `the citation names ${work.authors.join(", ")}`,
    );
  }

  const citedOrder = cited.filter((name) => recorded.includes(name));
  const recordOrder = recorded.filter((name) => cited.includes(name));
  if (citedOrder.join(" ") !== recordOrder.join(" ")) {
    notes.push(
      "the record lists the authors in a different order: " +
      `cited ${work.authors.join(", ")}; record ${recordNames.join(", ")}`,
    );
  }
}

function describe(work) {
  const page = work.firstPage ? `p. ${work.firstPage}` : work.page ? `pp. ${work.page}` : null;
  const volume = work.volume && `vol. ${work.volume}`;
  const parts = [work.authors?.join(", "), work.publisher, work.year, volume, page];
  return `'${work.title}' - ${parts.filter(Boolean).join(", ")} (${work.type})`;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
