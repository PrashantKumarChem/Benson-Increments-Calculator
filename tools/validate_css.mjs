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
 * cheap to find. The rest follow the same bargain from the other side, and
 * none of them is an error to a browser:
 *
 *   - a `var(--name)` whose `--name` was never declared resolves to nothing
 *     and the declaration is dropped, so a typo in a token name is invisible
 *     until somebody looks at the page
 *   - a breakpoint written in a token, in a query and in a script can stop
 *     agreeing, and the phone whose sheet is never measured says nothing
 *   - an attribute value spelled one way in the stylesheet and another in the
 *     script leaves a rule matching nothing, and a control that does nothing
 *   - a transform mixing a percentage with a token a script rewrites is not
 *     re-resolved once composited, and the element stays where the percentage
 *     alone put it - which is how the running total left the screen entirely
 *
 * There is no dependency here on purpose. The project ships no build step and
 * has no package.json, and a linter that needs one would be a larger change
 * than the bug it guards. Every check below is one that has actually broken
 * this site.
 *
 * tools/check_render.mjs is the other half of this, and needs a browser: it
 * opens the page and asks where its furniture ended up. Between them they
 * cover most of what a screenshot used to be the only way to see - though the
 * transform check exists precisely because neither a parser nor a headless
 * render could see that one.
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

/**
 * The same for a script, which also has comments this file cannot see through.
 *
 * The one above is CSS's, and CSS has no `//`. A line comment showing what an
 * assignment looks like - `// el("layout").dataset.tally = "gone"` - was read
 * by checkAttributeValues as an assignment, which took "gone" into the set of
 * words the script writes and stopped it reporting a stylesheet that genuinely
 * disagreed with the running code. The fault the check exists for, walking in
 * through the check.
 *
 * Not a tokeniser, and not wanted as one. Strings are tracked because the `//`
 * in a URL is not a comment and blanking from `https://` onward would quietly
 * truncate the source being scanned; a backslash outside a string is stepped
 * over so an escaped slash in a regular expression does not open one either;
 * and an unterminated quote gives up at the newline, because a mis-read of one
 * line should stay on that line. Nothing inside a comment is read for quotes,
 * so an apostrophe in prose ends nothing. Newlines survive, as they do above.
 */
export function withoutScriptComments(source) {
  let out = "";
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const pair = source.slice(index, index + 2);

    if (pair === "//") {
      while (index < source.length && source[index] !== "\n") { out += " "; index += 1; }
      continue;
    }
    if (pair === "/*") {
      while (index < source.length && source.slice(index, index + 2) !== "*/") {
        out += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (index < source.length) { out += "  "; index += 2; }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      out += char;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\n" && quote !== "`") break;
        out += source[index];
        if (source[index] === "\\" && index + 1 < source.length) {
          out += source[index + 1];
          index += 1;
        }
        index += 1;
      }
      if (index < source.length && source[index] === quote) { out += quote; index += 1; }
      continue;
    }
    if (char === "\\" && index + 1 < source.length) {
      out += source.slice(index, index + 2);
      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }
  return out;
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
/** Which line of the source an index falls on, for a message worth reading. */
const lineAt = (css, index) => css.slice(0, index).split("\n").length;

const TRANSFORM_RE = /(-webkit-)?transform\s*:\s*([^;}]*)/g;

/**
 * Pull out the body of every `calc(` in a value, parentheses balanced.
 *
 * A regexp cannot do this: `calc(100% - var(--x, 0px))` has nested parens, and
 * matching to the first `)` would stop inside the var and miss the percentage
 * that is the whole point.
 */
function calcBodies(value) {
  const bodies = [];
  const re = /calc\(/g;
  let match;
  while ((match = re.exec(value))) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < value.length && depth > 0) {
      if (value[index] === "(") depth += 1;
      else if (value[index] === ")") depth -= 1;
      index += 1;
    }
    bodies.push(value.slice(start, index - 1));
  }
  return bodies;
}

/**
 * A transform may not mix a percentage with a token a script rewrites.
 *
 * This one is here because it shipped. The phone sheet's slide was written the
 * tidy way - `translateY(calc(100% - var(--sheet-peek)))`, so the stylesheet
 * did the arithmetic instead of app.js handing over a pixel count - and the
 * sheet went off the bottom of the screen and stayed there.
 *
 * A percentage in a transform resolves against the element's own border box,
 * and the computed value keeps the percentage rather than the resolved length.
 * That is fine until the transform is composited, at which point Chrome does
 * not necessarily re-resolve it when a custom property inside the calc
 * changes. The sheet was left translated a full 100% - `var()` falling back to
 * its own default - with the total, which the README promises is always on
 * screen, simply gone.
 *
 * Nothing else here could see it. The stylesheet parses, every token it names
 * exists, the breakpoint agrees with the script, and every attribute value is
 * spelled the same in all three places. tools/check_render.mjs cannot see it
 * either: headless Chromium resolves the transform correctly, because the bug
 * needs the compositor of a browser on a desk. It is a fault with no symptom
 * anywhere it can be looked for, which leaves the one place it can be
 * described - the shape of the declaration that causes it.
 *
 * Narrow on purpose. A percentage beside a *static* token in a transform is
 * fine: `calc(50% - var(--space-5))` resolves once and nothing ever moves it.
 * What is not fine is a percentage beside a token something rewrites at
 * runtime, because a value that changes is the whole mechanism. So this reads
 * the scripts for the tokens they actually set and reports only those - which
 * is the same list checkTokens already builds, used the other way round. A
 * checker that banned the legal case as well is one somebody switches off.
 */
export function checkTransforms(css, scripts = {}) {
  const mutated = new Set();
  for (const source of Object.values(scripts)) {
    for (const [, name] of withoutScriptComments(source).matchAll(SET_FROM_SCRIPT_RE)) {
      mutated.add(name);
    }
  }
  if (mutated.size === 0) return [];

  const problems = [];
  const code = withoutComments(css);
  for (const [, , value] of code.matchAll(TRANSFORM_RE)) {
    const at = lineAt(code, code.indexOf(value));
    for (const body of calcBodies(value)) {
      if (!body.includes("%")) continue;
      for (const [, name] of body.matchAll(USED_RE)) {
        if (!mutated.has(name)) continue;
        problems.push(`${STYLESHEET}:${at}: transform mixes a percentage with var(${name}), `
          + `which a script rewrites - a composited transform is not re-resolved when it `
          + `changes, so the element stays where the percentage alone put it. Hand the `
          + `distance over as a length instead.`);
      }
    }
  }
  return problems;
}

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
      // Comments first: an assignment quoted in prose is not one the page ever
      // runs, and reading it as one widens what the script is taken to write.
      const script = withoutScriptComments(source);
      const written = new Set();
      const tested = new Set();
      for (const [, operator, rhs] of script.matchAll(datasetRe(property))) {
        for (const value of literalsIn(rhs)) (operator === "=" ? written : tested).add(value);
        // String() of a boolean has exactly two spellings, and this is the one
        // assignment that does not write its values out. Naming them here is
        // what lets the check see a value the source never says. It is an
        // assumption about a boolean, not about String() in general: String()
        // of anything else - a count, a key - has no fixed vocabulary, and a
        // value written that way would have to be spelled out to be checked.
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
    ...checkTransforms(css, scripts),
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
