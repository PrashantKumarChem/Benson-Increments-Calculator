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

import { checkStructure, checkTokens, withoutComments } from "./validate_css.mjs";

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

test("stripping comments keeps the line numbering", () => {
  const css = ".a {}\n/* two\n   lines */\n.b {}";
  assert.equal(withoutComments(css).split("\n").length, css.split("\n").length);
  assert.match(withoutComments(css), /^\.a \{\}\n\s*\n\s*\n\.b \{\}$/);
});
