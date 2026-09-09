/**
 * Tests for the tally sheet's arithmetic.
 *
 * These two numbers decide where the sheet comes to rest and how much of the
 * page it leaves reachable, and both are computed from measurements taken
 * mid-render. A sign error in either is not a wobble: it throws the sheet off
 * the top of the screen, or leaves it sitting across the grid.
 *
 *     node --test tools/
 */
import assert from "node:assert/strict";
import test from "node:test";

import { SWIPE, sheetMetrics, swipeIntent } from "../assets/sheet.js";

/* -------------------------------------------------------------------------- */
/* How far it slides                                                           */
/* -------------------------------------------------------------------------- */

test("the sheet hides exactly its body and leaves the rest showing", () => {
  // The head is the panel less the body: grip, label and total.
  assert.deepEqual(sheetMetrics({ panelHeight: 300, bodyHeight: 230 }),
    { hidden: 230, peek: 70 });
});

test("the parts add up to the whole, at any height", () => {
  for (const [panelHeight, bodyHeight] of [[300, 230], [88, 0], [640, 512], [70, 69]]) {
    const { hidden, peek } = sheetMetrics({ panelHeight, bodyHeight });
    assert.equal(hidden + peek, panelHeight,
      `${panelHeight}/${bodyHeight}: what hides plus what shows is the panel`);
  }
});

test("an empty body hides nothing and the whole panel peeks", () => {
  assert.deepEqual(sheetMetrics({ panelHeight: 70, bodyHeight: 0 }),
    { hidden: 0, peek: 70 });
});

test("neither number can go negative", () => {
  // A body taller than its panel is not a state the layout can reach - the
  // panel caps at 80vh and the body scrolls inside it - but a negative peek
  // would take padding off the document rather than adding it, and a negative
  // slide would throw the sheet upwards off the top of the screen.
  const { hidden, peek } = sheetMetrics({ panelHeight: 100, bodyHeight: 400 });
  assert.equal(peek, 0);
  assert.ok(hidden >= 0);

  const measured = sheetMetrics({ panelHeight: 0, bodyHeight: -12 });
  assert.equal(measured.hidden, 0);
  assert.equal(measured.peek, 0);
});

test("a panel not yet laid out measures as nothing rather than as something", () => {
  assert.deepEqual(sheetMetrics({ panelHeight: 0, bodyHeight: 0 }),
    { hidden: 0, peek: 0 });
});

/* -------------------------------------------------------------------------- */
/* What a drag meant                                                           */
/* -------------------------------------------------------------------------- */

test("a swipe up opens and a swipe down closes", () => {
  assert.equal(swipeIntent(500, 500 - SWIPE), true, "upwards opens");
  assert.equal(swipeIntent(500, 500 + SWIPE), false, "downwards closes");
});

test("a twitch is not a swipe, and does not read as a close", () => {
  // The distinction that matters: null and false are different answers, and
  // only one of them should move the sheet. Reading a twitch as a close is
  // how a sheet shuts itself while somebody is reading it.
  assert.equal(swipeIntent(500, 500), null, "a tap that did not move");
  assert.equal(swipeIntent(500, 500 + SWIPE - 1), null, "one pixel short, downwards");
  assert.equal(swipeIntent(500, 500 - SWIPE + 1), null, "one pixel short, upwards");
});

test("the threshold is the first distance that counts, not the last that does not", () => {
  assert.equal(swipeIntent(0, SWIPE), false);
  assert.equal(swipeIntent(0, SWIPE - 1), null);
});

test("the threshold can be overridden without changing the meaning", () => {
  assert.equal(swipeIntent(0, 10, 5), false);
  assert.equal(swipeIntent(0, 10, 20), null);
  assert.equal(swipeIntent(0, -10, 5), true);
});

test("a measurement that is not a number moves nothing", () => {
  // dataset round-trips through strings, so anything unparseable arrives here
  // as NaN. Both comparisons against NaN are false, so without the guard a
  // drag that could not be measured would fall through to "close".
  assert.equal(swipeIntent(Number("nonsense"), 500), null);
  assert.equal(swipeIntent(500, Number(undefined)), null);
  assert.equal(swipeIntent(NaN, NaN), null);
});

test("the top of the screen is a coordinate, not a missing one", () => {
  // Number("") is 0, not NaN, so a guard on NaN alone would let a drag from a
  // blank dataset read as a drag from y=0. app.js is what stops that: it
  // stores "" for a drag starting inside the scrolling body and returns on it
  // before asking here. y=0 itself is a real place to start a swipe.
  assert.equal(Number(""), 0, "the assumption app.js's own guard rests on");
  assert.equal(swipeIntent(0, 500), false, "dragged down from the very top");
});
