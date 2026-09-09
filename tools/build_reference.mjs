/**
 * Build reference.html from the content files in reference/.
 *
 * The reference page is documentation, so it is rendered here rather than in
 * the browser. That decision buys three things a fetch-at-load-time page
 * cannot have: it works when the folder is opened from disk, its text is in
 * the HTML for screen readers and search engines, and it needs no JavaScript
 * module - which means nothing new in assets/ for tools/validate_assets.py to
 * have to reason about.
 *
 * The cost is that reference.html is generated and committed, so a hand-edit
 * of it is lost on the next build. That is the same bargain the repository
 * already makes with CSV_data_files/manifest.json, and it is enforced the same
 * way: CI regenerates and diffs.
 *
 *     node tools/build_reference.mjs           write reference.html
 *     node tools/build_reference.mjs --check   fail if it is out of date
 *
 * What a contributor edits is reference/. The number at the front of a
 * filename sets the order, the rest of the filename becomes the heading, and
 * the extension picks the renderer: .md is prose, .csv is a table. Adding a
 * section is adding a file - there is no list here to keep in step, which is
 * the whole point of reading the directory instead of naming its contents.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = "reference";
const PAGE = "reference.html";

/* ---------------------------------------------------------------- reading */

/**
 * Rows from comma-separated text, honouring quoted fields.
 *
 * This is deliberately *not* assets/benson.js's parseRows. That one splits on
 * the last comma, because an increment row is a name and a number and a name
 * may contain a comma. Here the second column is prose, which is full of
 * commas, so the same rule would shred it. Quoting is what a spreadsheet
 * writes when a cell contains a comma, and a chemist editing the glossary in
 * Excel should get a file that round-trips.
 */
export function parseDelimited(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let pending = false;

  const endField = () => { row.push(field); field = ""; pending = false; };
  const endRow = () => {
    endField();
    // A trailing newline would otherwise add a row of one empty cell.
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  const source = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch !== '"') { field += ch; continue; }
      // "" inside a quoted field is one literal quote, as Excel writes it.
      if (source[i + 1] === '"') { field += '"'; i++; continue; }
      quoted = false;
    } else if (ch === '"' && field === "") {
      quoted = true; pending = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n") {
      endRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || pending || row.length) endRow();
  return rows;
}

/** The order a section is shown in: the digits a filename starts with. */
export const orderOf = (name) => Number.parseInt(name, 10);

/**
 * The heading a filename stands for.
 *
 * `01_The_Method.md` is "The Method". The convention is the one
 * CSV_data_files/ already uses, so a contributor who has added an increment
 * category has already learnt it: two digits for the order, then the name
 * spelled as it should be displayed.
 */
export const sectionTitle = (name) =>
  name.replace(/^\d+[_-]?/, "").replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();

/** A stable fragment id, so a definition can be linked to directly. */
export const slug = (text) =>
  text.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

/* --------------------------------------------------------------- escaping */

const escapeHtml = (text) => text
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/**
 * The sentinel a code span is parked behind while the rest of the line is
 * escaped and marked up.
 *
 * U+0001 is not a character this content can contain, and escapeHtml leaves
 * it alone, so no placeholder can be mistaken for content and no content for
 * a placeholder. A visible marker - even an unlikely one - is a bug waiting
 * for the first paragraph that happens to spell it.
 */
const MARK = "\u0001";

/**
 * Inline markup: code, links, bold, italic, and nothing else.
 *
 * Order is the whole correctness argument here.
 *
 * Code spans come out first, into placeholders, because their contents are
 * Benson notation - `[COd]-Cd(H)2`, `C-(C)2(H)2` - and must survive verbatim
 * rather than being read as a link or an emphasis.
 *
 * Then the text is escaped, and only then is markup applied. The other order
 * escapes the tags this function has just generated, turning <em> into
 * &lt;em&gt;. tools/reference.test.mjs asserts that directly, because it is
 * the kind of mistake that looks fine until one paragraph has an ampersand.
 */
export function inline(text) {
  const codes = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => `${MARK}${codes.push(code) - 1}${MARK}`);

  out = escapeHtml(out);

  // A link needs an http(s) destination. That is not a style rule: it is what
  // keeps `[COd]-Cd(H)2` and `Cis- (one t-butyl)` literal, and what stops a
  // javascript: URL from ever reaching an href.
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, href) => `<a href="${href}">${label}</a>`);

  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  // Underscores stay literal on purpose: this repository's prose is full of
  // filenames like 01_The_Method.md, and _emphasis_ would eat them.

  return out.replace(new RegExp(`${MARK}(\\d+)${MARK}`, "g"),
    (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
}

/* -------------------------------------------------------------- rendering */

/**
 * A table, rendering whatever columns the file happens to have.
 *
 * Nothing here names a column. Add one to reference/05_Glossary.csv and it
 * appears; that is what keeps the content in the content files rather than
 * half here and half there.
 */
export function renderTable(rows) {
  if (!rows.length) return "";
  const [head, ...body] = rows;
  const cells = (row, tag) => row
    .map((cell) => `<${tag} class="ref-cell">${inline(cell)}</${tag}>`).join("");
  // Three columns or fewer is a list of definitions: it should wrap inside the
  // measure, because the second column is a sentence. More than three is a
  // data table - the five categories carry six - and wrapping one of those
  // shreds every column at once, so it keeps its natural width and scrolls
  // inside its box instead. The column count is the only thing that decides
  // this, so a file that grows a column gets the right behaviour on its own.
  const wide = head.length > 3 ? " ref-table-wide" : "";
  return [
    '<div class="ref-table-wrap">',
    `<table class="ref-table${wide}">`,
    `<thead><tr>${cells(head, "th")}</tr></thead>`,
    "<tbody>",
    ...body.map((row) => `<tr>${cells(row, "td")}</tr>`),
    "</tbody>",
    "</table>",
    "</div>",
  ].join("\n");
}

const CSV_DIRECTIVE = /^\{\{csv:\s*(.+?)\s*\}\}$/;

/**
 * The Markdown subset: headings, paragraphs, bullet lists, and an include.
 *
 * A subset rather than the whole language, because the whole language means a
 * dependency and this site has none. What is here is what the content needs;
 * anything else is shown as the characters it is made of.
 */
export function renderMarkdown(text, { includeCsv } = {}) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join("\n"))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) {
      out.push("<ul>", ...list.map((item) => `<li>${inline(item)}</li>`), "</ul>");
    }
    list = [];
  };
  const flush = () => { flushParagraph(); flushList(); };

  for (const line of lines) {
    const directive = CSV_DIRECTIVE.exec(line.trim());
    if (directive) {
      flush();
      // With no resolver - renderMarkdown called on its own, as the tests call
      // it - the directive stays visible as the text it is. With one, a path
      // that cannot be read stops the build. That is deliberate: the quiet
      // failure here would be a page missing a whole table, and nobody reads
      // every section after every edit. The message names the file, because
      // ENOENT on its own does not say which directive was wrong.
      if (!includeCsv) { out.push(escapeHtml(line.trim())); continue; }
      try {
        out.push(includeCsv(directive[1]));
      } catch (error) {
        throw new Error(`{{csv: ${directive[1]}}} could not be read: ${error.message}`);
      }
      continue;
    }
    if (!line.trim()) { flush(); continue; }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const title = heading[2].trim();
      out.push(`<h3 id="${slug(title)}">${inline(title)}</h3>`);
      continue;
    }

    // A bullet is a hyphen and a space at the start of a line. `2.51-4.35`
    // and `Cis- (one t-butyl)` are therefore not bullets, which is the point.
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) { flushParagraph(); list.push(bullet[1]); continue; }

    flushList();
    paragraph.push(line.trim());
  }
  flush();
  return out.join("\n");
}

/* ------------------------------------------------------------------ build */

/**
 * The asset version, read from index.html rather than written here.
 *
 * validate_assets.py prints "The version lives in index.html and nowhere else"
 * when it fails, and this keeps that literally true. Reading it makes the two
 * pages disagreeing impossible by construction; validate_assets.py checking
 * both pages then catches the one case left, which is someone hand-editing
 * the generated file.
 */
export function versionFrom(indexHtml) {
  const found = [...indexHtml.matchAll(/assets\/[A-Za-z0-9_.-]+\?v=([^"']+)/g)]
    .map((match) => match[1]);
  const unique = [...new Set(found)];
  if (unique.length !== 1) {
    throw new Error(`index.html should carry exactly one asset version, found ${unique.length}`);
  }
  return unique[0];
}

const readSections = (dir) => readdirSync(dir)
  .filter((name) => /^\d+.*\.(md|csv)$/.test(name))
  .sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b));

export function buildPage(root = ROOT) {
  const dir = path.join(root, CONTENT_DIR);
  const read = (file) => readFileSync(path.join(root, file), "utf8");
  const includeCsv = (target) => renderTable(parseDelimited(read(target)));

  const names = readSections(dir);
  if (!names.length) throw new Error(`${CONTENT_DIR}/ has no numbered .md or .csv sections`);

  const sections = names.map((name) => {
    const title = sectionTitle(name);
    const body = name.endsWith(".csv")
      ? renderTable(parseDelimited(readFileSync(path.join(dir, name), "utf8")))
      : renderMarkdown(readFileSync(path.join(dir, name), "utf8"), { includeCsv });
    return { name, title, id: slug(title), body };
  });

  const version = versionFrom(read("index.html"));
  const contents = sections
    .map((s) => `      <li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join("\n");
  const body = sections.map((s) => [
    `    <section class="ref-section" id="${s.id}">`,
    `      <h2>${escapeHtml(s.title)}</h2>`,
    s.body.split("\n").map((line) => (line ? `      ${line}` : line)).join("\n"),
    "    </section>",
  ].join("\n")).join("\n\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reference &middot; Benson Increments Calculator</title>
<meta name="description" content="The Benson group-additivity method, the notation the calculator uses, and the sources the values come from.">
<link rel="stylesheet" href="assets/styles.css?v=${version}">
<!-- Generated by tools/build_reference.mjs from the files in reference/.

     Do not edit this file. Edit reference/ and run:

         node tools/build_reference.mjs

     CI regenerates it and fails if the result differs from what was
     committed, so a hand-edit here is not merely lost - it is reported.

     The asset version above is read out of index.html, which is where it
     lives; it is never written by hand in this file. -->
</head>
<body class="ref-body">
<div class="wrap">

  <header class="bar ref-bar">
    <h1>Reference</h1>
    <a class="ref-back" href="index.html">&larr; Calculator</a>
  </header>

  <nav class="ref-toc" aria-label="Sections">
    <p class="ref-toc-head">On this page</p>
    <ul>
${contents}
    </ul>
  </nav>

  <main class="ref-main">
${body}
  </main>

  <footer>
    Every section of this page is a file in <code>reference/</code>.
    <a href="https://github.com/PrashantKumarChem/Benson-Increments-Calculator">Source and data on GitHub</a> &middot; GPL-3.0.
  </footer>
</div>
</body>
</html>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.join(ROOT, PAGE);
  const built = buildPage();
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(target, "utf8"); } catch { /* not built yet */ }
    if (current !== built) {
      console.error(`${PAGE} is out of date. Run: node tools/build_reference.mjs`);
      process.exit(1);
    }
    console.log(`OK - ${PAGE} matches ${CONTENT_DIR}/.`);
  } else {
    writeFileSync(target, built, "utf8");
    console.log(`Wrote ${PAGE} from ${readSections(path.join(ROOT, CONTENT_DIR)).length} sections.`);
  }
}
