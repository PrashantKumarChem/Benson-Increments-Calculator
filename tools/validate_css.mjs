/**
 * Check that assets/styles.css parses, and that every token it names exists.
 *
 * CSS has no compiler and fails quietly. A stray comment-close shipped
 * mid-session once and ended a comment early, which put the rest of that
 * comment's prose into the stylesheet as code; the browser's error recovery
 * then swallowed the entire `@media` block that followed it, and the tally
 * panel simply stopped existing on desktop. Every check in this repository
 * passed. A screenshot caught it.
 *
 * That is the class of fault this file exists for: not style, not opinion, but
 * the stylesheet no longer meaning what it says. Two structural mistakes can
 * cause it - an unbalanced comment and an unbalanced brace - and both are
 * cheap to find. A third check follows the same bargain from the other side: a
 * `var(--name)` whose `--name` was never declared is not an error to a browser
 * either. It resolves to nothing and the declaration is dropped, so a typo in a
 * token name is invisible until somebody looks at the page.
 *
 * There is no dependency here on purpose. The project ships no build step and
 * has no package.json, and a linter that needs one would be a larger change
 * than the bug it guards. The three checks below are the ones that have
 * actually broken this site.
 *
 *     node tools/validate_css.mjs
 *
 * The checks are exported so tools/css.test.mjs can feed them broken CSS and
 * confirm they fail. A check that has never been shown to fail is not a check.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

/** Where a token may be declared from, besides the stylesheet itself. */
export const SCRIPTS = ["assets/app.js"];
export const STYLESHEET = "assets/styles.css";

/**
 * Walk the stylesheet once, tracking whether we are inside a comment or a
 * string, and report every comment and brace that does not balance.
 *
 * Strings are tracked because a comment-close written inside `content`, and a
 * brace inside a selector like `[href*="{"]`, are both legal and neither is a
 * fault; treating them as code is how a checker like this earns a reputation
 * for crying wolf and gets deleted.
 */
export function checkStructure(css, file = STYLESHEET) {
  const problems = [];
  const openBraces = [];
  let commentStart = null;
  let index = 0;
  let line = 1;

  while (index < css.length) {
    const char = css[index];
    const pair = css.slice(index, index + 2);

    if (commentStart !== null) {
      if (pair === "*/") { commentStart = null; index += 2; continue; }
      if (char === "\n") line += 1;
      index += 1;
      continue;
    }

    if (pair === "/*") { commentStart = line; index += 2; continue; }

    // A `*/` out here closed a comment that was never opened, which means the
    // one before it ended somewhere the author did not intend.
    if (pair === "*/") {
      problems.push(`${file}:${line}: a '*/' that closes no comment - the comment `
        + "before it ended early, and everything between is now stylesheet");
      index += 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      const startedAt = line;
      index += 1;
      while (index < css.length && css[index] !== quote) {
        if (css[index] === "\\") index += 1;
        else if (css[index] === "\n") break;
        index += 1;
      }
      if (css[index] !== quote) {
        problems.push(`${file}:${startedAt}: a ${quote} string that is never closed`);
        continue;
      }
      index += 1;
      continue;
    }

    if (char === "{") { openBraces.push(line); index += 1; continue; }
    if (char === "}") {
      if (openBraces.length === 0) {
        problems.push(`${file}:${line}: a '}' with no '{' to match - `
          + "everything after it is outside the rule it looks like it is in");
      } else {
        openBraces.pop();
      }
      index += 1;
      continue;
    }

    if (char === "\n") line += 1;
    index += 1;
  }

  if (commentStart !== null) {
    problems.push(`${file}:${commentStart}: a '/*' that is never closed - `
      + "the rest of the stylesheet is a comment");
  }
  for (const at of openBraces) {
    problems.push(`${file}:${at}: a '{' that is never closed`);
  }
  return problems;
}

/** The stylesheet with every comment replaced by blanks, so line numbers hold. */
export function withoutComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

const DECLARED_RE = /(--[A-Za-z0-9_-]+)\s*:/g;
const USED_RE = /var\(\s*(--[A-Za-z0-9_-]+)/g;
/** `element.style.setProperty("--name", ...)`, wherever a script does it. */
const SET_FROM_SCRIPT_RE = /setProperty\(\s*["'](--[A-Za-z0-9_-]+)["']/g;

/**
 * Every `var(--name)` must name a token something actually declares.
 *
 * Two tokens are set from JavaScript rather than in the stylesheet - the
 * sheet's travel and the padding it leaves under the page, both of which are
 * measured - so the scripts are read for those instead of the names being
 * listed here. A hardcoded allowlist would go stale the first time one was
 * renamed, which is the fault this check is for.
 */
export function checkTokens(css, scripts = {}) {
  const code = withoutComments(css);
  const declared = new Set([...code.matchAll(DECLARED_RE)].map(([, name]) => name));
  for (const source of Object.values(scripts)) {
    for (const [, name] of source.matchAll(SET_FROM_SCRIPT_RE)) declared.add(name);
  }

  const problems = [];
  const seen = new Set();
  for (const [, name] of code.matchAll(USED_RE)) {
    if (declared.has(name) || seen.has(name)) continue;
    seen.add(name);
    problems.push(`${STYLESHEET}: var(${name}) is used but ${name} is never declared, `
      + "so the declaration using it is dropped");
  }
  return problems;
}

/** The token naming the width at which the tally panel becomes a sheet. */
export const SHEET_MAX = "--sheet-max";

const SHEET_MAX_RE = new RegExp(`${SHEET_MAX}\\s*:\\s*(\\d+)px`);
const MEDIA_WIDTH_RE = /\((max|min)-width:\s*(\d+)px\)/g;
/** A media query written into a script, which is the copy that goes stale. */
const SCRIPT_QUERY_RE = /\((?:max|min)-width:\s*\d+px\)/;

/**
 * One breakpoint, in one place, checked everywhere it had to be written again.
 *
 * A media query cannot read a custom property and a script cannot import a
 * stylesheet, so the sheet's breakpoint is written in three languages: the
 * token, the queries that use it, and the script that has to agree about which
 * side of it the page is on. Nothing in CSS or JavaScript can bind those. This
 * can, and the failure it prevents is a phone whose sheet is never measured -
 * it then sits across the bottom of the screen permanently, covering the grid.
 *
 * The same bargain tools/validate_assets.py strikes with the asset version:
 * where a value cannot live in one place, it is checked to be one value.
 */
export function checkBreakpoint(css, scripts = {}) {
  const problems = [];
  const declared = withoutComments(css).match(SHEET_MAX_RE);
  if (!declared) {
    return [`${STYLESHEET}: ${SHEET_MAX} is not declared as a px width, so nothing `
      + "says where the tally panel becomes a sheet"];
  }

  const max = Number(declared[1]);
  const min = max + 1;
  const widths = [...withoutComments(css).matchAll(MEDIA_WIDTH_RE)]
    .map(([, edge, value]) => ({ edge, value: Number(value) }));

  if (!widths.some((w) => w.edge === "max" && w.value === max)) {
    problems.push(`${STYLESHEET}: ${SHEET_MAX} is ${max}px, but no media query asks for `
      + `(max-width: ${max}px) - the sheet's own rules are at another width`);
  }
  if (!widths.some((w) => w.edge === "min" && w.value === min)) {
    problems.push(`${STYLESHEET}: ${SHEET_MAX} is ${max}px, so the rail beside the grid `
      + `should begin at (min-width: ${min}px), and no media query does`);
  }
  // The pair has to meet exactly. One pixel of overlap shows both layouts at
  // once; one pixel of gap shows neither.
  for (const { edge, value } of widths) {
    if (edge === "min" && value === max) {
      problems.push(`${STYLESHEET}: (min-width: ${max}px) overlaps ${SHEET_MAX} by a pixel`);
    }
    if (edge === "max" && value === min) {
      problems.push(`${STYLESHEET}: (max-width: ${min}px) overlaps the rail by a pixel`);
    }
  }

  for (const [path, source] of Object.entries(scripts)) {
    if (!source.includes(SHEET_MAX)) {
      problems.push(`${path}: does not name ${SHEET_MAX}, so it is not reading the `
        + "breakpoint from the stylesheet");
    }
    const written = source.match(SCRIPT_QUERY_RE);
    if (written) {
      problems.push(`${path}: writes the width query '${written[0]}' out in full - `
        + `it should be built from ${SHEET_MAX} so there is one of it`);
    }
  }
  return problems;
}

/** The attributes a script writes and the stylesheet then selects on. */
export const STATE_ATTRIBUTES = ["data-open", "data-tally"];
/** Where those attributes are written a third time, as the markup ships. */
export const MARKUP = "index.html";

/** `[data-open="true"]`, in either quote or none, all of which CSS allows. */
const selectorValuesRe = (attribute) =>
  new RegExp(`\\[${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\]]*))\\]`, "g");
/** `panel.dataset.open = ...` and `panel.dataset.open !== ...`, to the statement's end. */
const datasetRe = (property) =>
  new RegExp(`dataset\\.${property}\\s*(=(?!=)|[!=]==?)([^;\\n]*)`, "g");
const LITERAL_RE = /"([^"]*)"|'([^']*)'/g;
/** `data-tally="empty"` as an attribute of an element, not as prose about one. */
const markupValueRe = (attribute) => new RegExp(`\\s${attribute}\\s*=\\s*"([^"]*)"`, "g");

/** `data-open` is `dataset.open`, which is the only name the script knows it by. */
const datasetName = (attribute) =>
  attribute.replace(/^data-/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const literalsIn = (text) =>
  [...text.matchAll(LITERAL_RE)].map(([, double, single]) => double ?? single);

/**
 * One state, spelled the same way by everything that reads or writes it.
 *
 * An attribute selector cannot read a custom property any more than a media
 * query can, so `data-open="true"` and `data-tally="empty"` are written out in
 * the stylesheet, in the script that sets them, and in the markup they start
 * in. Change the spelling in one and nothing anywhere complains: the selector
 * simply stops matching, and the phone sheet stays shut with its own close
 * transition still running, or the grid keeps a column reserved for a panel
 * that has nothing in it. There is no error, and the page still loads.
 *
 * The script is the one that says what a value is, so what it writes is taken
 * as the vocabulary and the other two are checked against it. Not the reverse:
 * it writes "false" and "filled" as well, and neither needs a rule of its own -
 * "not open" and "not empty" are the plain state of the page, and demanding a
 * selector per written value would mean writing rules that do nothing.
 *
 * The same bargain checkBreakpoint strikes with the sheet's width: where a
 * value cannot live in one place, it is checked to be one value.
 */
export function checkAttributeValues(css, scripts = {}, markup = "") {
  const problems = [];
  const code = withoutComments(css);
  const html = markup.replace(/<!--[\s\S]*?-->/g, "");

  for (const attribute of STATE_ATTRIBUTES) {
    const property = datasetName(attribute);
    const selected = new Set([...code.matchAll(selectorValuesRe(attribute))]
      .map(([, quoted, single, bare]) => (quoted ?? single ?? bare).trim()));
    if (selected.size === 0) {
      problems.push(`${STYLESHEET}: nothing selects on [${attribute}], so whatever a script `
        + "writes there changes nothing about the page");
      continue;
    }

    for (const [path, source] of Object.entries(scripts)) {
      const written = new Set();
      const tested = new Set();
      for (const [, operator, rhs] of source.matchAll(datasetRe(property))) {
        for (const value of literalsIn(rhs)) (operator === "=" ? written : tested).add(value);
        // String() of a boolean has exactly two spellings, and this is the one
        // assignment that does not write its values out. Naming them here is
        // what lets the check see a value the source never says.
        if (operator === "=" && /\bString\(/.test(rhs)) {
          written.add("true").add("false");
        }
      }

      if (written.size === 0) {
        problems.push(`${path}: never assigns dataset.${property}, so the [${attribute}] `
          + "rules in the stylesheet are waiting for something that never arrives");
        continue;
      }
      const vocabulary = [...written].map((value) => `"${value}"`).join(", ");

      for (const value of selected) {
        if (written.has(value)) continue;
        problems.push(`${STYLESHEET}: selects on [${attribute}="${value}"], but ${path} only `
          + `ever writes ${vocabulary} - the rule matches nothing`);
      }
      for (const value of tested) {
        if (written.has(value)) continue;
        problems.push(`${path}: compares dataset.${property} against "${value}", which it never `
          + `writes - only ${vocabulary} - so the comparison has one answer for good`);
      }
      for (const [, value] of html.matchAll(markupValueRe(attribute))) {
        if (written.has(value)) continue;
        problems.push(`${MARKUP}: ships ${attribute}="${value}", which ${path} only ever `
          + `replaces with ${vocabulary} - the page starts in a state nothing can return it to`);
      }
    }
  }
  return problems;
}

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

export function main() {
  const css = read(STYLESHEET);
  const scripts = Object.fromEntries(SCRIPTS.map((path) => [path, read(path)]));
  const markup = read(MARKUP);

  const problems = [
    ...checkStructure(css),
    ...checkTokens(css, scripts),
    ...checkBreakpoint(css, scripts),
    ...checkAttributeValues(css, scripts, markup),
  ];
  if (problems.length) {
    console.error(`${problems.length} problem(s) found:\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error("\nA browser would not have reported any of these.");
    return 1;
  }

  const tokens = new Set([...withoutComments(css).matchAll(DECLARED_RE)].map(([, n]) => n));
  console.log(`OK - ${STYLESHEET} parses, and all ${tokens.size} tokens it names are declared.`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
