/**
 * The reference page's content pipeline.
 *
 * reference/ holds what the page says; tools/build_reference.mjs turns it into
 * reference.html. The renderer is small on purpose - a documented subset of
 * Markdown rather than the whole of it - and this file is what keeps the
 * subset honest.
 *
 * The cases below are written from strings that actually occur in this
 * repository: `[COd]-Cd(H)2`, `C-(C)2(H)2`, `Cis- (one t-butyl)`, ranges
 * written `2.51-4.35`. Generic Markdown fixtures would pass while the real
 * content broke, because the things that break here are brackets, dashes and
 * parentheses - which is to say, Benson notation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  renderMarkdown,
  renderTable,
  parseDelimited,
  sectionTitle,
  versionFrom,
  buildPage,
  orderOf,
} from "./build_reference.mjs";

test("a paragraph is a paragraph, and blank lines separate them", () => {
  const html = renderMarkdown("One.\n\nTwo.");
  assert.equal(html, "<p>One.</p>\n<p>Two.</p>");
});

test("a wrapped line is one paragraph, not two", () => {
  assert.equal(renderMarkdown("One\ntwo."), "<p>One\ntwo.</p>");
});

test("HTML in the content is shown, never executed", () => {
  assert.equal(
    renderMarkdown("a <script>alert(1)</script> b"),
    "<p>a &lt;script&gt;alert(1)&lt;/script&gt; b</p>",
  );
  assert.equal(renderMarkdown("Cohen & Benson"), "<p>Cohen &amp; Benson</p>");
});

test("escaping happens before markup, so generated tags survive it", () => {
  // Reverse the order and the <em> below comes out as &lt;em&gt;.
  assert.equal(renderMarkdown("*a & b*"), "<p><em>a &amp; b</em></p>");
});

test("code spans carry Benson notation without losing a character", () => {
  assert.equal(
    renderMarkdown("The `[COd]-Cd(H)2` rows"),
    "<p>The <code>[COd]-Cd(H)2</code> rows</p>",
  );
  assert.equal(renderMarkdown("`C-(C)2(H)2`"), "<p><code>C-(C)2(H)2</code></p>");
});

test("a bracketed group name is not mistaken for a link", () => {
  // `[COd]` is followed by `-Cd`, not by `(url)`, so it is literal text.
  assert.equal(renderMarkdown("[COd]-Cd(H)2 is a ketene row"),
    "<p>[COd]-Cd(H)2 is a ketene row</p>");
  // The trap: a bracket followed by a parenthesis that is not a URL.
  assert.equal(renderMarkdown("Cis- (one t-butyl)"), "<p>Cis- (one t-butyl)</p>");
  assert.equal(renderMarkdown("[NI](one t-butyl)"), "<p>[NI](one t-butyl)</p>");
});

test("a real link becomes a link, and only http(s) is allowed", () => {
  assert.equal(
    renderMarkdown("[NIST](https://webbook.nist.gov/chemistry/)"),
    '<p><a href="https://webbook.nist.gov/chemistry/">NIST</a></p>',
  );
  // A javascript: URL is content, not a destination.
  assert.equal(
    renderMarkdown("[x](javascript:alert(1))"),
    "<p>[x](javascript:alert(1))</p>",
  );
});

test("underscores are literal, because filenames are full of them", () => {
  assert.equal(
    renderMarkdown("Edit `01_The_Method.md` in reference/"),
    "<p>Edit <code>01_The_Method.md</code> in reference/</p>",
  );
  assert.equal(renderMarkdown("a _b_ c"), "<p>a _b_ c</p>");
});

test("a hyphen inside a value is not a bullet", () => {
  assert.equal(renderMarkdown("published as 2.51-4.35 kJ/mol"),
    "<p>published as 2.51-4.35 kJ/mol</p>");
});

test("bullets become a list", () => {
  assert.equal(
    renderMarkdown("- one\n- two"),
    "<ul>\n<li>one</li>\n<li>two</li>\n</ul>",
  );
});

test("bold and italic, and bold wins over italic on the same run", () => {
  assert.equal(renderMarkdown("**Total −125.8 kJ/mol**"),
    "<p><strong>Total −125.8 kJ/mol</strong></p>");
  assert.equal(renderMarkdown("*Chem. Rev.* **1993**"),
    "<p><em>Chem. Rev.</em> <strong>1993</strong></p>");
});

test("a heading inside a section is an h3, since the section title is the h2", () => {
  assert.equal(renderMarkdown("## Butane"), "<h3 id=\"butane\">Butane</h3>");
});

test("delimited text splits on commas but respects quotes", () => {
  const rows = parseDelimited('a,b\nCd,"a carbon, doubly bonded"\n');
  assert.deepEqual(rows, [["a", "b"], ["Cd", "a carbon, doubly bonded"]]);
});

test("a doubled quote inside a quoted field is one quote, as Excel writes it", () => {
  const rows = parseDelimited('h1,h2\nCd,"(""d"" for double)"\n');
  assert.deepEqual(rows[1], ["Cd", '("d" for double)']);
});

test("a blank trailing line does not become an empty row", () => {
  assert.equal(parseDelimited("a,b\nc,d\n\n").length, 2);
});

test("a table renders every column it is given, with no column hardcoded", () => {
  const html = renderTable([["Term", "Meaning"], ["A-value", "a penalty"]]);
  assert.match(html, /<th[^>]*>Term<\/th>/);
  assert.match(html, /<th[^>]*>Meaning<\/th>/);
  assert.match(html, /<td[^>]*>A-value<\/td>/);
  // Add a column to the CSV and it appears; nothing here names the columns.
  const three = renderTable([["a", "b", "c"], ["1", "2", "3"]]);
  // <th, not /<th/, because <thead> would match that too.
  assert.equal((three.match(/<th\s/g) ?? []).length, 3);
});

test("a table cell is escaped and takes inline markup", () => {
  const html = renderTable([["h"], ["`C-(C)(H)3` & co"]]);
  assert.match(html, /<code>C-\(C\)\(H\)3<\/code> &amp; co/);
});

test("the filename gives the order and the heading", () => {
  assert.equal(orderOf("01_The_Method.md"), 1);
  assert.equal(orderOf("10_Later.md"), 10);
  assert.equal(sectionTitle("01_The_Method.md"), "The Method");
  assert.equal(sectionTitle("08_The_Five_Categories.md"), "The Five Categories");
  assert.equal(sectionTitle("03_Notation.csv"), "Notation");
});

test("the version is read from index.html, never written here", () => {
  const page = '<link href="assets/styles.css?v=2026-09-09i">'
    + '<script type="module" src="assets/app.js?v=2026-09-09i"></script>';
  assert.equal(versionFrom(page), "2026-09-09i");
});

test("a half-bumped index.html is refused rather than guessed at", () => {
  // Picking either version would stamp reference.html with a version that is
  // wrong for half of index.html, and quietly.
  assert.throws(
    () => versionFrom('"assets/a.js?v=2026-09-09a" "assets/b.js?v=2026-09-09b"'),
    /exactly one asset version, found 2/,
  );
  assert.throws(() => versionFrom("<p>no assets here</p>"), /found 0/);
});

test("an include with no resolver stays visible instead of vanishing", () => {
  assert.equal(renderMarkdown("{{csv: notation/categories.csv}}"),
    "{{csv: notation/categories.csv}}");
});

test("an include that cannot be read names the file it failed on", () => {
  assert.throws(
    () => renderMarkdown("{{csv: nope/missing.csv}}", {
      includeCsv: () => { throw new Error("ENOENT"); },
    }),
    /\{\{csv: nope\/missing\.csv\}\} could not be read/,
  );
});

test("sections are numbered by position, and every one can be linked to", () => {
  const page = buildPage(path.resolve(import.meta.dirname, ".."));

  // The numbers a reader sees run 1..n with no gaps, whatever the filenames
  // happen to be numbered. Inserting a section is allowed to renumber files;
  // it is not allowed to make the page count 1, 2, 4.
  const numbers = [...page.matchAll(/<h2><span class="ref-num">(\d+)<\/span>/g)]
    .map((m) => Number(m[1]));
  assert.ok(numbers.length >= 2, "expected several sections");
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1));

  // Every section heading carries an anchor pointing at its own id, so a
  // definition can be linked to directly.
  const sections = [...page.matchAll(/<section class="ref-section" id="([^"]+)"/g)]
    .map((m) => m[1]);
  assert.equal(sections.length, numbers.length);
  for (const id of sections) {
    assert.ok(page.includes(`<a class="ref-anchor" href="#${id}"`), `no anchor for #${id}`);
    assert.ok(page.includes(`<li><a href="#${id}">`), `no contents entry for #${id}`);
  }
});
