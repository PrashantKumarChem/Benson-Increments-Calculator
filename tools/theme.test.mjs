/**
 * Tests for the theme rules, and for the copy of them index.html cannot avoid.
 *
 * A remembered theme has to be applied before the page is first painted, and a
 * module is deferred until after that - so index.html carries four lines of
 * inline script, and an inline script cannot import. The key and the two
 * values are therefore written twice, and that cannot be fixed.
 *
 * What can be fixed is the silence. The last test here reads index.html and
 * fails if its inline script and assets/theme.js stop agreeing, which turns a
 * duplication that used to drift quietly into one that fails a check.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  DARK, LIGHT, THEME_KEY, isDark, isTheme, nextTheme, themeLabel,
} from "../assets/theme.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = await readFile(path.join(ROOT, "index.html"), "utf8");

/* -------------------------------------------------------------------------- */
/* The third state                                                             */
/* -------------------------------------------------------------------------- */

test("an explicit choice wins over the machine, both ways round", () => {
  assert.equal(isDark(DARK, false), true, "chose dark on a light machine");
  assert.equal(isDark(LIGHT, true), false, "chose light on a dark machine");
});

test("having chosen nothing follows the machine", () => {
  assert.equal(isDark(undefined, true), true);
  assert.equal(isDark(undefined, false), false);
  // dataset.theme is "" rather than undefined when the attribute is absent
  // but has been touched, which is the same state and must read the same way.
  assert.equal(isDark("", true), true);
  assert.equal(isDark("", false), false);
});

test("a value that is neither light nor dark is not a choice", () => {
  // Nothing should ever write one. If something does, following the machine is
  // the honest answer - the alternative is silently calling it light.
  assert.equal(isDark("purple", true), true);
  assert.equal(isDark("purple", false), false);
});

test("only light and dark are themes", () => {
  assert.equal(isTheme(LIGHT), true);
  assert.equal(isTheme(DARK), true);
  for (const value of ["", "Dark", "purple", undefined, null, 0]) {
    assert.equal(isTheme(value), false, `${JSON.stringify(value)} is not a theme`);
  }
});

/* -------------------------------------------------------------------------- */
/* What the button does and says                                               */
/* -------------------------------------------------------------------------- */

test("the button switches to the other theme", () => {
  assert.equal(nextTheme(true), LIGHT);
  assert.equal(nextTheme(false), DARK);
});

test("pressing the button twice returns to where it started", () => {
  for (const dark of [true, false]) {
    const once = nextTheme(dark);
    assert.equal(nextTheme(once === DARK), dark ? DARK : LIGHT);
  }
});

test("the label names where the button goes, not where the page is", () => {
  assert.match(themeLabel(true), /light/, "in dark, it offers light");
  assert.match(themeLabel(false), /dark/, "in light, it offers dark");
});

/* -------------------------------------------------------------------------- */
/* The copy in index.html                                                      */
/* -------------------------------------------------------------------------- */

/** The inline script in the head - the one that runs before the first paint. */
function inlineScript() {
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, "index.html should have exactly one inline script");
  return scripts[0][1];
}

test("index.html reads the theme from the key theme.js writes it to", () => {
  assert.match(
    inlineScript(),
    new RegExp(`getItem\\(\\s*["']${THEME_KEY}["']\\s*\\)`),
    `the inline script must read localStorage["${THEME_KEY}"]`);
});

test("index.html honours exactly the two values theme.js defines", () => {
  const script = inlineScript();
  for (const value of [LIGHT, DARK]) {
    assert.ok(script.includes(`"${value}"`), `the inline script must accept "${value}"`);
  }
});

test("index.html sets the attribute isDark reads", () => {
  // isDark is given document.documentElement.dataset.theme; the inline script
  // is what puts it there before app.js exists. Different spellings of the
  // same attribute would leave a remembered theme applied but unreported.
  assert.match(inlineScript(), /documentElement\.dataset\.theme\s*=/);
});

test("index.html guards the read, because localStorage can throw outright", () => {
  // A browser set to block site data throws on access rather than returning
  // null, and an exception here would stop the page before it painted at all.
  assert.match(inlineScript(), /try\s*\{[\s\S]*getItem[\s\S]*\}\s*catch/);
});
