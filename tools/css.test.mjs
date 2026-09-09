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

import { checkBreakpoint, checkStructure, checkTokens, withoutComments } from "./validate_css.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesheet = await readFile(path.join(ROOT, "assets/styles.css"), "utf8");
const appjs = await readFile(path.join(ROOT, "assets/app.js"), "utf8");

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

test("stripping comments keeps the line numbering", () => {
  const css = ".a {}\n/* two\n   lines */\n.b {}";
  assert.equal(withoutComments(css).split("\n").length, css.split("\n").length);
  assert.match(withoutComments(css), /^\.a \{\}\n\s*\n\s*\n\.b \{\}$/);
});
