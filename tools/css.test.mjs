/**
 * Tests for the stylesheet checks in tools/validate_css.mjs.
 *
 * The real stylesheet passing is the least of what is asserted here. A checker
 * that has only ever been run against valid input is not known to work - the
 * one it replaces would have been "passing" throughout the session that broke
 * the page. So most of what follows is deliberately broken CSS, including a
 * reconstruction of the fault that prompted the file: a comment closed early,
 * which fed its own prose to the parser and took the next block with it.
 *
 * The false-positive cases matter as much. A brace inside a selector and a
 * comment-close inside a string are both legal CSS, and a checker that reports
 * them is one somebody switches off.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  checkAttributeValues,
  checkBreakpoint,
  checkStructure,
  checkTokens,
  checkTransforms,
  withoutComments,
  withoutScriptComments,
} from "./validate_css.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesheet = await readFile(path.join(ROOT, "assets/styles.css"), "utf8");
const appjs = await readFile(path.join(ROOT, "assets/app.js"), "utf8");
const markup = await readFile(path.join(ROOT, "index.html"), "utf8");

/* -------------------------------------------------------------------------- */
/* The stylesheet as it stands                                                 */
/* -------------------------------------------------------------------------- */

test("the shipped stylesheet parses", () => {
  assert.deepEqual(checkStructure(stylesheet), []);
});

test("every token the shipped stylesheet names is declared", () => {
  assert.deepEqual(checkTokens(stylesheet, { "assets/app.js": appjs }), []);
});

/* -------------------------------------------------------------------------- */
/* The fault this file exists for                                              */
/* -------------------------------------------------------------------------- */

test("a comment that closes early is caught, and named as such", () => {
  // What actually shipped: a second comment-close, so the prose after the
  // first one became stylesheet and the media query after it was swallowed.
  const broken = [
    "/* The panel is fixed on a phone so its height stops being the",
    "   document's problem. */ */",
    "@media (max-width: 859px) { .tally-panel { position: fixed; } }",
  ].join("\n");

  const problems = checkStructure(broken);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /closes no comment/);
  assert.match(problems[0], /^assets\/styles\.css:2:/);
});

test("a comment that is never closed is caught", () => {
  const problems = checkStructure(".a { color: red; }\n/* and then nothing\n");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /never closed/);
  assert.match(problems[0], /^assets\/styles\.css:2:/);
});

test("an unbalanced closing brace is caught", () => {
  const problems = checkStructure(".a { color: red; }\n.b { color: blue; }\n}\n");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no '\{' to match/);
  assert.match(problems[0], /^assets\/styles\.css:3:/);
});

test("a block that is never closed is caught, and reported where it opened", () => {
  const problems = checkStructure("@media (min-width: 860px) {\n  .a { color: red; }\n");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /never closed/);
  assert.match(problems[0], /^assets\/styles\.css:1:/);
});

test("several faults are all reported, not just the first", () => {
  const problems = checkStructure("}\n}\n/* open\n");
  assert.equal(problems.length, 3);
});

/* -------------------------------------------------------------------------- */
/* Legal CSS that a careless checker would report                              */
/* -------------------------------------------------------------------------- */

test("a comment-close inside a string is not a fault", () => {
  assert.deepEqual(checkStructure('.a::after { content: "*/"; }'), []);
});

test("a brace inside a selector is not a fault", () => {
  assert.deepEqual(checkStructure('a[href*="{"] { color: red; }'), []);
});

test("an escaped quote does not end the string early", () => {
  assert.deepEqual(checkStructure('.a::after { content: "she said \\"}\\""; }'), []);
});

test("the universal selector is not read as a comment", () => {
  assert.deepEqual(checkStructure("*, *::before, *::after { box-sizing: border-box; }"), []);
});

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

test("a var() naming a token nothing declares is caught", () => {
  const problems = checkTokens(":root { --ink: #111; }\n.a { color: var(--nik); }");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /var\(--nik\) is used but --nik is never declared/);
});

test("a token declared anywhere in the stylesheet counts as declared", () => {
  const css = "@media (min-width: 860px) { :root { --wide: 1; } }\n.a { opacity: var(--wide); }";
  assert.deepEqual(checkTokens(css), []);
});

test("a token set from a script counts as declared", () => {
  const css = ".tally-panel { transform: translateY(var(--sheet-hidden, 0px)); }";
  assert.deepEqual(checkTokens(css, { app: 'panel.style.setProperty("--sheet-hidden", x);' }), []);
  assert.equal(checkTokens(css).length, 1, "and is a fault when no script sets it");
});

test("a token named only inside a comment does not count as declared", () => {
  const css = "/* --ghost: 1px; */\n.a { width: var(--ghost); }";
  assert.equal(checkTokens(css).length, 1);
});

test("each undeclared token is reported once, however often it is used", () => {
  const css = ".a { color: var(--nik); }\n.b { color: var(--nik); }\n.c { color: var(--nik); }";
  assert.equal(checkTokens(css).length, 1);
});

/* -------------------------------------------------------------------------- */
/* The sheet breakpoint, which is written in three languages                    */
/* -------------------------------------------------------------------------- */

/** A stylesheet and a script that agree, as the shipped pair does. */
const agreed = {
  css: ":root { --sheet-max: 859px; }\n"
    + "@media (max-width: 859px) { .tally-panel { position: fixed; } }\n"
    + "@media (min-width: 860px) { .layout { grid-template-columns: 1fr 23rem; } }",
  js: 'const isSheet = matchMedia(`(max-width: ${read("--sheet-max")})`);',
};

test("the shipped stylesheet and script agree about the breakpoint", () => {
  assert.deepEqual(checkBreakpoint(stylesheet, { "assets/app.js": appjs }), []);
});

test("a stylesheet and script that agree pass", () => {
  assert.deepEqual(checkBreakpoint(agreed.css, { app: agreed.js }), []);
});

test("moving the token without moving the media queries is caught", () => {
  const css = agreed.css.replace("--sheet-max: 859px", "--sheet-max: 767px");
  const problems = checkBreakpoint(css, { app: agreed.js });
  assert.equal(problems.length, 2, "both the sheet's query and the rail's are now wrong");
  assert.match(problems[0], /no media query asks for \(max-width: 767px\)/);
  assert.match(problems[1], /should begin at \(min-width: 768px\)/);
});

test("moving one media query without the token is caught", () => {
  const css = agreed.css.replace("(min-width: 860px)", "(min-width: 900px)");
  const problems = checkBreakpoint(css, { app: agreed.js });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /rail beside the grid should begin at \(min-width: 860px\)/);
});

test("a breakpoint pair that overlaps by a pixel is caught", () => {
  const css = agreed.css.replace("(min-width: 860px)", "(min-width: 859px)");
  const problems = checkBreakpoint(css, { app: agreed.js });
  assert.ok(problems.some((p) => /overlaps --sheet-max by a pixel/.test(p)));
});

test("a script that writes the width out instead of reading it is caught", () => {
  const problems = checkBreakpoint(agreed.css, {
    app: 'if (!matchMedia("(max-width: 859px)").matches) return;',
  });
  assert.equal(problems.length, 2);
  assert.match(problems[0], /does not name --sheet-max/);
  assert.match(problems[1], /writes the width query '\(max-width: 859px\)' out in full/);
});

test("a script that misspells the token name is caught", () => {
  // The failure this guards: getPropertyValue returns "", the query is
  // invalid, it matches nothing, and a phone silently takes the desktop path.
  const problems = checkBreakpoint(agreed.css, {
    app: 'matchMedia(`(max-width: ${read("--sheet-width")})`);',
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /does not name --sheet-max/);
});

test("a missing token is caught before anything else is checked", () => {
  const problems = checkBreakpoint("@media (max-width: 859px) { .a { color: red; } }");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /--sheet-max is not declared as a px width/);
});

test("a token declared only in a comment does not count", () => {
  const problems = checkBreakpoint(`/* ${"--sheet-max"}: 859px; */\n.a { color: red; }`);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not declared/);
});

test("the other breakpoints are none of this check's business", () => {
  const css = `${agreed.css}\n@media (max-width: 520px) { .a { color: red; } }`
    + "\n@media (max-width: 620px) { .b { color: red; } }";
  assert.deepEqual(checkBreakpoint(css, { app: agreed.js }), []);
});

/* -------------------------------------------------------------------------- */
/* The state attributes, which are written in three languages too              */
/* -------------------------------------------------------------------------- */

/**
 * Change a string, and fail the test if it was not there to change.
 *
 * A `replace` that matches nothing hands back the input untouched, the check
 * passes on it, and a test written to prove the check can fail proves only
 * that valid input passes. That is indistinguishable from a check that cannot
 * fail at all, which is the thing this file exists not to be.
 */
function mutate(source, from, to) {
  const changed = source.split(from).join(to);
  assert.notEqual(changed, source, `nothing to change: '${from}' is not in the source`);
  return changed;
}

/** A stylesheet, script and markup that agree, as the shipped three do. */
const bound = {
  css: '.layout[data-tally="empty"] .actions { display: none; }\n'
    + '.tally-panel:not([data-open="true"]) .tally-body { visibility: hidden; }',
  js: 'el("tally-panel").dataset.open = String(open);\n'
    + 'setPanelOpen(el("tally-panel").dataset.open !== "true");\n'
    + 'el("layout").dataset.tally = isEmpty ? "empty" : "filled";',
  html: '<div class="layout" id="layout" data-tally="empty">',
};

test("the shipped stylesheet, script and markup agree about the state attributes", () => {
  assert.deepEqual(checkAttributeValues(stylesheet, { "assets/app.js": appjs }, markup), []);
});

test("a stylesheet, script and markup that agree pass", () => {
  assert.deepEqual(checkAttributeValues(bound.css, { app: bound.js }, bound.html), []);
});

test("renaming the value in the stylesheet and not the script is caught", () => {
  const css = mutate(bound.css, 'data-open="true"', 'data-open="open"');
  const problems = checkAttributeValues(css, { app: bound.js }, bound.html);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /selects on \[data-open="open"\], but app only ever writes/);
});

test("renaming the value in the script and not the stylesheet is caught", () => {
  const js = mutate(bound.js, '? "empty" : "filled"', '? "none" : "filled"');
  const problems = checkAttributeValues(bound.css, { app: js }, bound.html);
  assert.equal(problems.length, 2, "the stylesheet and the markup are both left behind");
  assert.match(problems[0], /selects on \[data-tally="empty"\], but app only ever writes/);
  assert.match(problems[1], /index\.html: ships data-tally="empty"/);
});

test("renaming what the script writes, and not what it tests, is caught", () => {
  // The one that hides from a check reading only string literals: the writing
  // side spells its values through String(), so the only "true" written down
  // is on the reading side, and a check that pooled the two would see nothing.
  const js = mutate(bound.js, "dataset.open = String(open)", 'dataset.open = open ? "yes" : "no"');
  const problems = checkAttributeValues(bound.css, { app: js }, bound.html);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /selects on \[data-open="true"\], but app only ever writes "yes", "no"/);
  assert.match(problems[1], /compares dataset\.open against "true", which it never writes/);
});

test("markup that starts in a state the script never writes is caught", () => {
  const html = mutate(bound.html, 'data-tally="empty"', 'data-tally="blank"');
  const problems = checkAttributeValues(bound.css, { app: bound.js }, html);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /index\.html: ships data-tally="blank"/);
});

test("a stylesheet that never selects on the attribute is caught", () => {
  const css = mutate(bound.css, '.tally-panel:not([data-open="true"])', ".tally-panel.shut");
  const problems = checkAttributeValues(css, { app: bound.js }, bound.html);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /nothing selects on \[data-open\]/);
});

test("a script that never assigns the attribute is caught", () => {
  const js = mutate(bound.js, "dataset.open = String(open)", "setAttribute(SOME_ATTR, open)");
  const problems = checkAttributeValues(bound.css, { app: js }, bound.html);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /never assigns dataset\.open/);
});

test("the values are what the assignment writes, not what its line happens to say", () => {
  // el("layout") sits on the same line as the assignment; "layout" is not a
  // state the panel can be in, and a rule selecting it is still a dead rule.
  const css = mutate(bound.css, 'data-tally="empty"', 'data-tally="layout"');
  const problems = checkAttributeValues(css, { app: bound.js }, bound.html);
  assert.ok(problems.some((p) => /selects on \[data-tally="layout"\]/.test(p)));
});

/* -------------------------------------------------------------------------- */
/* Places the value is only being talked about                                 */
/* -------------------------------------------------------------------------- */

test("the value inside a stylesheet comment is not a selector", () => {
  const css = `/* was .tally-panel[data-open="ajar"] until 2026 */\n${bound.css}`;
  assert.deepEqual(checkAttributeValues(css, { app: bound.js }, bound.html), []);
});

test("the value inside a markup comment is not the page's state", () => {
  const html = `<!-- data-tally="blank" was the old spelling -->\n${bound.html}`;
  assert.deepEqual(checkAttributeValues(bound.css, { app: bound.js }, html), []);
});

test("an attribute whose name merely starts the same is not this one", () => {
  const css = `${bound.css}\n.x[data-openness="dim"] { opacity: .5; }`
    + '\n.y[data-tallying="none"] { display: none; }';
  assert.deepEqual(checkAttributeValues(css, { app: bound.js }, bound.html), []);
});

test("an unquoted attribute value reads the same as a quoted one", () => {
  const css = mutate(bound.css, '[data-open="true"]', "[data-open=true]");
  assert.deepEqual(checkAttributeValues(css, { app: bound.js }, bound.html), []);
});

test("a value the script only mentions in a line comment is not one it writes", () => {
  // The hole this closes, and the dangerous direction: the comment taught the
  // check a word, the stylesheet had genuinely drifted, and the check passed.
  const css = mutate(bound.css, 'data-tally="empty"', 'data-tally="gone"');
  const js = `${bound.js}\n// example: el("layout").dataset.tally = "gone";`;
  const problems = checkAttributeValues(css, { app: js }, bound.html);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /selects on \[data-tally="gone"\], but app only ever writes/);
});

test("a value mentioned in a block comment is not one it writes either", () => {
  const css = mutate(bound.css, 'data-open="true"', 'data-open="ajar"');
  const js = `/* it read dataset.open = "ajar" until the sheet arrived */\n${bound.js}`;
  const problems = checkAttributeValues(css, { app: js }, bound.html);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /selects on \[data-open="ajar"\], but app only ever writes/);
});

test("an apostrophe in a comment does not run on into the code below it", () => {
  const js = `// the sheet's own word, and the stylesheet's\n${bound.js}`;
  assert.deepEqual(checkAttributeValues(bound.css, { app: js }, bound.html), []);
});

test("the // in a URL is not a comment, and the code after it still counts", () => {
  // app.js has one of these. Blanking from https:// onward would truncate the
  // source being scanned, and the check would report a script that assigns
  // nothing - a fault invented by the reading of it.
  const js = 'const REPO = "https://example.com/x"; el("p").dataset.open = String(open);\n'
    + 'el("layout").dataset.tally = isEmpty ? "empty" : "filled";';
  assert.deepEqual(checkAttributeValues(bound.css, { app: js }, bound.html), []);
});

test("stripping a script's comments keeps the line numbering", () => {
  const js = "const a = 1;\n// one\n/* two\n   lines */\nconst b = 2;";
  const stripped = withoutScriptComments(js);
  assert.equal(stripped.split("\n").length, js.split("\n").length);
  assert.match(stripped, /^const a = 1;\n\s*\n\s*\n\s*\nconst b = 2;$/);
});

test("the shipped script keeps every line, and its comments none of their words", () => {
  const stripped = withoutScriptComments(appjs);
  assert.equal(stripped.split("\n").length, appjs.split("\n").length);
  assert.ok(stripped.includes('dataset.open = String(open)'), "the code is still there");
  assert.ok(stripped.includes("https://github.com/"), "and so is the URL");
  assert.ok(!/:has\(\) selector/.test(stripped), "and the prose is not");
});

test("stripping comments keeps the line numbering", () => {
  const css = ".a {}\n/* two\n   lines */\n.b {}";
  assert.equal(withoutComments(css).split("\n").length, css.split("\n").length);
  assert.match(withoutComments(css), /^\.a \{\}\n\s*\n\s*\n\.b \{\}$/);
});


/* -------------------------------------------------------------------------- */
/* A percentage in a transform, beside a token a script rewrites               */
/* -------------------------------------------------------------------------- */

/** Enough of app.js for the check to know which tokens move at runtime. */
const SETS_BOTH = 'panel.style.setProperty("--sheet-hidden", d);'
  + ' document.documentElement.style.setProperty("--sheet-peek", p);';

test("the fault that shipped is reported", () => {
  // Written exactly as it was written the day it went out, which is the tidy
  // way: let the stylesheet do the arithmetic instead of app.js handing over a
  // pixel count. The sheet went off the bottom of the screen and stayed there.
  const css = '.tally-panel { transform: translateY(calc(100% - var(--sheet-peek, 0px))); }';
  const problems = checkTransforms(css, { app: SETS_BOTH });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /percentage with var\(--sheet-peek\)/);
});

test("the fix that replaced it is not reported", () => {
  // The single most important false positive to avoid: this is the shipped
  // code. A check that flags the correct version is a check that gets deleted
  // the same afternoon it lands.
  const css = '.tally-panel { transform: translateY(var(--sheet-hidden, 0px)); }';
  assert.deepEqual(checkTransforms(css, { app: SETS_BOTH }), []);
});

test("a percentage beside a token nothing rewrites is left alone", () => {
  // --space-5 is declared once and never touched again, so the percentage
  // resolves once and nothing moves it afterwards. Legal, and useful.
  const css = '.a { transform: translateY(calc(50% - var(--space-5))); }';
  assert.deepEqual(checkTransforms(css, { app: SETS_BOTH }), []);
});

test("a percentage with no var at all is left alone", () => {
  const css = '.a { transform: translateY(calc(100% - 12px)); }';
  assert.deepEqual(checkTransforms(css, { app: SETS_BOTH }), []);
});

test("the var is found inside a nested function and behind a prefix", () => {
  const nested = '.a { transform: translate(0, calc(100% - var(--sheet-peek))); }';
  assert.equal(checkTransforms(nested, { app: SETS_BOTH }).length, 1,
    "matching to the first ) would stop inside var() and miss the percentage");

  const prefixed = '.a { -webkit-transform: translateY(calc(100% - var(--sheet-peek))); }';
  assert.equal(checkTransforms(prefixed, { app: SETS_BOTH }).length, 1);
});

test("a transition naming transform is not a transform", () => {
  // `transition: transform .25s` next to a width that legitimately mixes the
  // two. Reading the word rather than the declaration would report this.
  const css = '.a { transition: transform .25s; width: calc(100% - var(--sheet-peek)); }';
  assert.deepEqual(checkTransforms(css, { app: SETS_BOTH }), []);
});

test("the fault written inside a comment is not the fault", () => {
  const css = "/* transform: translateY(calc(100% - var(--sheet-peek))); */\n.a { color: red; }";
  assert.deepEqual(checkTransforms(css, { app: SETS_BOTH }), []);
});

test("with no script to read, nothing is claimed", () => {
  // Which tokens move is knowable only from the scripts. Given none, the check
  // has no grounds to report anything and says nothing rather than guessing.
  const css = '.tally-panel { transform: translateY(calc(100% - var(--sheet-peek, 0px))); }';
  assert.deepEqual(checkTransforms(css), []);
});

test("the shipped stylesheet has no such transform", () => {
  assert.deepEqual(checkTransforms(stylesheet, { "assets/app.js": appjs }), []);
});
