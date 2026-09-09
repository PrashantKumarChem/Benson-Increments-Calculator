/**
 * The arithmetic behind the tally sheet, with no DOM in it.
 *
 * On a phone the tally panel is a sheet at the foot of the page: the total is
 * always on screen and the working out is one tap away. It is slid rather than
 * resized, because animating a height reflows a document holding 236 cards on
 * every frame, and layout cannot run on the compositor.
 *
 * A transform needs a distance, and the distance is not a constant - it is
 * however tall the contributions happen to be, in whatever font the reader has
 * chosen. Measuring is app.js's job, since only it can ask an element how tall
 * it is. Deciding what the measurements mean is this file's, which is what
 * makes it testable: the two numbers below are where a sign error puts the
 * sheet off the bottom of the screen, or leaves it covering the grid.
 */

/**
 * How far the sheet slides, and how much of it stays showing.
 *
 * `hidden` is the part that goes below the fold - the body, entire. `peek` is
 * what is left: the grip, the label and the total. The page takes `peek` as
 * bottom padding, so nothing ends up behind a panel that, being fixed, no
 * longer occupies any space in the flow.
 *
 * Both are clamped at zero. A body taller than the panel that contains it is
 * not a state the layout can produce - the panel is capped at 80vh and the
 * body scrolls inside it - but a negative peek would pull padding off the
 * document rather than adding it, and a negative slide would throw the sheet
 * upwards off the top of the screen. Neither is worth trusting a measurement
 * not to produce, especially one taken mid-render.
 */
export function sheetMetrics({ panelHeight, bodyHeight }) {
  const hidden = Math.max(0, bodyHeight);
  return { hidden, peek: Math.max(0, panelHeight - hidden) };
}

/**
 * How far a finger has to travel before it meant it.
 *
 * Below this a drag is a twitch - a tap that moved, or a thumb settling on the
 * way to a button - and the sheet stays where it was.
 */
export const SWIPE = 40;

/**
 * What a finished drag asked for: true to open, false to close, null when it
 * was too small to have asked for anything.
 *
 * Null rather than false, because "not a swipe" and "swipe downwards" are
 * different answers and only one of them should move the sheet. Reading a
 * twitch as a close is how a sheet shuts itself while somebody is reading it.
 *
 * Up opens, which is the direction the sheet travels to arrive.
 */
export function swipeIntent(from, to, threshold = SWIPE) {
  const travelled = to - from;
  if (!Number.isFinite(travelled) || Math.abs(travelled) < threshold) return null;
  return travelled < 0;
}
