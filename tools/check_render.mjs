/**
 * Open the page in a real browser and check that it is still a usable page.
 *
 * Everything else in tools/ reads the source. That is why the failures this
 * project actually ships are the ones nothing here can see: valid CSS that
 * parses, passes every check, and puts the calculator somewhere nobody can
 * reach it.
 *
 * It has happened twice. A comment closed early, fed its own prose to the
 * parser, and the browser's error recovery swallowed the media query that
 * followed - the tally panel stopped existing on desktop, and every check
 * passed. Then the sheet was made to bounce: the panel is anchored to the
 * bottom and grows upwards, and a transitioned transform took a quarter of a
 * second to catch up with a height that had already changed, so the head
 * jumped and settled on every pick for months.
 *
 * Both were caught by a person looking at the page. That is not a check.
 *
 * WHAT THIS CANNOT SEE, said out loud so nobody trusts it further than it
 * goes. The same afternoon produced a third failure - the sheet's slide
 * written as `translateY(calc(100% - var(--sheet-peek)))`, which pushed it a
 * full 100% down and off the screen - and this file does not catch it.
 *
 * That is a measured result rather than an assumption. Three browsers were
 * tried against a stylesheet with the fault put back in: the headless shell
 * Playwright uses by default, the full Chromium binary in its new headless
 * mode, and that same binary with --use-gl=angle --enable-gpu
 * --ignore-gpu-blocklist. All three resolved the transform correctly and
 * placed the sheet exactly where it belongs. The bug needs a compositor that
 * will not re-resolve a percentage when the custom property inside the calc
 * changes, and no headless configuration reproduces it.
 *
 * So it is checked where it can be: tools/validate_css.mjs refuses that shape
 * of declaration outright - a percentage in a transform beside a token a
 * script rewrites. A fault with no symptom in any instrument has to be caught
 * by its cause.
 *
 * The lesson generalises, which is why it is written here rather than in a
 * commit message. A headless render is a much better check than reading the
 * source, and still not the same thing as looking at the page.
 *
 * So this is the smallest thing that would have caught them: load the page,
 * and ask it where its own furniture ended up. Every assertion below is a
 * failure this repository has actually had, which is the same bargain
 * tools/validate_css.mjs strikes - a check that has never been shown to fail
 * is not a check.
 *
 *     node tools/check_render.mjs
 *
 * It needs a browser, and it is the only thing here that does. That is why it
 * is not a *.test.mjs: `node --test tools/*.test.mjs` stays runnable on a
 * clean clone with nothing installed, which is a property this project has and
 * should keep. CI installs a browser for this one step; a contributor who
 * wants to run it locally is told how, once, below.
 *
 * The server is here rather than borrowed for the same reason. The page reads
 * its data with fetch, so file:// will not do, and a dependency for thirty
 * lines of static file serving would cost more than it saves.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

/** A static server for exactly one directory, and nothing above it. */
function serve() {
  const server = createServer(async (request, response) => {
    // The page asks for everything with ?v=, which is not part of the path.
    const path = decodeURIComponent(new URL(request.url, "http://x").pathname);
    const target = join(ROOT, normalize(path).replace(/^([/\\])+/, ""));

    // normalize() collapses any ".." before this runs, so a path that still
    // points outside the root was trying to.
    if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      response.writeHead(403).end("no");
      return;
    }
    try {
      const body = await readFile(target.endsWith(sep) ? join(target, "index.html") : target);
      response.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

const problems = [];
const fail = (what, detail) => problems.push(`${what}\n      ${detail}`);

/**
 * Settle before measuring, and measure geometry rather than computed style.
 *
 * Both matter. A layout read taken in the same tick as a render can be a frame
 * behind - which cost this project an afternoon of chasing a panel width that
 * was never wrong - and computed style lags further than a bounding rectangle
 * does. Reading offsetHeight forces the layout that makes the rest honest.
 */
async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    void document.body.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

/**
 * Choose a few increments.
 *
 * Every width below is checked twice, once before this and once after, because
 * the panel is a different size in the two states and the first version of
 * this file only ever saw the empty one. That is not a hypothetical: with
 * nothing chosen the action buttons are not rendered at all, and the last time
 * this page pushed the document wider than the window it was Reset hanging off
 * the end of a panel - which is to say, in exactly the state the checks were
 * not looking at. Two of the assertions here were written, run against a
 * deliberately broken stylesheet, and passed, before that was noticed.
 */
async function choose(page, count) {
  for (let i = 0; i < count; i++) {
    await page.locator(".grid button").nth(i).click();
    await page.waitForTimeout(120);
  }
  await settle(page);
}

/** How far past the right edge of the window anything reaches, and what. */
async function spill(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const over = root.scrollWidth - root.clientWidth;
    if (over <= 0) return { over, culprit: null };
    const wide = [...document.querySelectorAll("*")]
      .find((el) => el.getBoundingClientRect().right > root.clientWidth + 0.5);
    const name = wide ? (wide.id || (typeof wide.className === "string" && wide.className)
      || wide.tagName) : null;
    return { over, culprit: name };
  });
}

/**
 * Whether the line under the total is on the page, painted, and inside the window.
 *
 * Asked by hit test as well as by rectangle, for the reason the phone check
 * gives: a box can be right while something else covers it. Scrolled into
 * view first, because on a phone the line sits in the sheet's own scrolling
 * body.
 */
async function methodLine(page) {
  await page.evaluate(() => document.getElementById("method").scrollIntoView({ block: "nearest" }));
  await settle(page);
  return page.evaluate(() => {
    const line = document.getElementById("method");
    const box = line.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + Math.min(box.width / 2, 20), box.top + box.height / 2);
    return {
      shown: !line.hidden && box.height > 0,
      painted: !!(hit && line.contains(hit)),
      inside: box.left >= -0.5 && box.right <= innerWidth + 0.5,
      text: line.textContent.trim(),
      at: `${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}x${Math.round(box.height)}`,
    };
  });
}

const lineReport = (line) =>
  `shown: ${line.shown}, painted: ${line.painted}, inside the window: ${line.inside}, ` +
  `box ${line.at}, text ${JSON.stringify(line.text.slice(0, 60))}`;

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("This check needs a browser, and it is the only one that does.\n");
    console.error("  npm install --no-save playwright && npx playwright install chromium\n");
    console.error("Everything else in tools/ runs on a clean clone with nothing installed;");
    console.error("that is deliberate, which is why this is a separate step.");
    return 1;
  }

  const { server, port } = await serve();
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch();

  try {
    /* ---------------------------------------------------------------- */
    /* The page loads at all                                             */
    /* ---------------------------------------------------------------- */
    {
      const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto(base, { waitUntil: "load" });

      // A stale module once left the page saying "Loading increment data" for
      // ever. It is also what makes every check below mean anything: they all
      // pass trivially on a page with nothing on it.
      try {
        await page.waitForSelector(".grid button", { timeout: 15000 });
      } catch {
        const status = await page.textContent(".status").catch(() => null);
        fail("the increments never arrived",
          `no .grid button after 15s; the page says ${JSON.stringify(status)}` +
          (errors.length ? `\n      first error: ${errors[0]}` : ""));
        // Everything below asks the page where its furniture is. On a page
        // that never built any, all of it either throws or passes for the
        // wrong reason, and both are worse than stopping here.
        await page.close();
        return report();
      }

      const count = await page.locator(".grid button").count();
      if (count && count < 200) {
        fail("not all of the increments rendered", `${count} cards, expected 236`);
      }
      if (errors.length) {
        fail("the page logged errors while loading", errors.slice(0, 3).join(" | "));
      }

      /* -------------------------------------------------------------- */
      /* The panel is beside the grid, not underneath it                 */
      /* -------------------------------------------------------------- */
      // The failure this catches is the one that has already happened: a
      // swallowed @media block, after which the desktop layout silently became
      // the phone one.
      await settle(page);
      const beside = () => page.evaluate(() => ({
        panelLeft: document.getElementById("tally-panel").getBoundingClientRect().left,
        mainRight: document.querySelector("main").getBoundingClientRect().right,
      }));

      for (const state of ["with nothing chosen", "with increments chosen"]) {
        if (state === "with increments chosen") await choose(page, 3);
        const { panelLeft, mainRight } = await beside();
        if (panelLeft < mainRight) {
          fail(`the running total is not beside the increments on a wide screen (${state})`,
            `panel starts at ${Math.round(panelLeft)}px, ` +
            `the grid ends at ${Math.round(mainRight)}px`);
        }
        const over = await spill(page);
        if (over.over > 0) {
          fail(`the page is wider than the window at 1180px (${state})`,
            `${over.over}px of overflow, first past the edge: ${over.culprit}`);
        }

        // The method's own uncertainty, under the total once there is one.
        // Unlike the rest of this file, not a failure this page has had: it is
        // checked because it went into the panel whose layout has broken twice
        // with every other check passing.
        const line = await methodLine(page);
        const wanted = state === "with increments chosen";
        if (wanted ? !(line.shown && line.painted && line.inside) : line.shown) {
          fail(wanted ? "the method's uncertainty is not under the total on a wide screen"
            : "the method's uncertainty is shown with nothing chosen", lineReport(line));
        }
      }
      await page.close();
    }

    /* ---------------------------------------------------------------- */
    /* The total is on the screen on a phone                             */
    /* ---------------------------------------------------------------- */
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector(".grid button", { timeout: 15000 });
      await settle(page);

      const peek = await page.evaluate(() => {
        const panel = document.getElementById("tally-panel");
        const box = panel.getBoundingClientRect();
        // What is actually painted at the foot of the screen. A rectangle can
        // be right while something else covers it; a hit test cannot.
        const atFoot = document.elementFromPoint(innerWidth / 2, innerHeight - 8);
        return {
          visible: Math.max(0, Math.min(box.bottom, innerHeight) - box.top),
          top: box.top,
          height: innerHeight,
          footIsPanel: !!(atFoot && panel.contains(atFoot)),
        };
      });

      // 24px is not a design number, it is the smallest thing that could not
      // be a rounding error. The head is nearer 65px.
      if (peek.visible < 24 || !peek.footIsPanel) {
        fail("the running total is not on the screen on a phone",
          `${Math.round(peek.visible)}px of the panel is within the ${peek.height}px ` +
          `viewport (top at ${Math.round(peek.top)}px), and the foot of the screen ` +
          `${peek.footIsPanel ? "is" : "is NOT"} the panel`);
      }

      /* -------------------------------------------------------------- */
      /* Adding an increment does not move the sheet                     */
      /* -------------------------------------------------------------- */
      // The panel is anchored to the bottom and grows upwards, and is pushed
      // down by exactly as much as it grew. The two cancel, so the head must
      // not move at all - it did, for as long as a transition took to catch up
      // with a height that had already changed.
      const tops = [];
      for (let i = 0; i < 4; i++) {
        tops.push(await page.evaluate(() =>
          Math.round(document.getElementById("tally-panel").getBoundingClientRect().top)));
        await page.locator(".grid button").nth(i).click();
        // Inside the slide, where a bounce would be visible if there were one.
        await page.waitForTimeout(90);
        tops.push(await page.evaluate(() =>
          Math.round(document.getElementById("tally-panel").getBoundingClientRect().top)));
        await page.waitForTimeout(300);
      }
      const moved = [...new Set(tops)];
      if (moved.length > 1) {
        fail("the sheet moves when an increment is added",
          `the head sat at ${moved.join("px, ")}px across four picks; it should not move`);
      }

      // The picks above leave the panel at its tallest and its buttons on
      // screen, which is the state the width has to survive.
      const narrow = await spill(page);
      if (narrow.over > 0) {
        fail("the page is wider than the window at 390px",
          `${narrow.over}px of overflow, first past the edge: ${narrow.culprit}`);
      }

      /* -------------------------------------------------------------- */
      /* The line under the total, and the note its mark leads to        */
      /* -------------------------------------------------------------- */
      // Not failures this page has had either. On a phone the line is in the
      // folded body, and the note is at the foot of a page whose foot the
      // sheet sits over - so following the mark has to leave the note showing.
      await page.locator("#panel-toggle").click();
      await page.waitForTimeout(450);
      const line = await methodLine(page);
      if (!(line.shown && line.painted && line.inside)) {
        fail("the method's uncertainty cannot be read in the open sheet at 390px", lineReport(line));
      } else {
        await page.locator("#method .cite-mark a").first().click();
        await page.waitForTimeout(600);
        await settle(page);
        const note = await page.evaluate(() => {
          const head = document.querySelector("#notes .notes-head");
          if (!head) return null;
          const box = head.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + Math.min(box.width / 2, 20), box.top + box.height / 2);
          return {
            top: Math.round(box.top),
            onScreen: box.top >= 0 && box.bottom <= innerHeight,
            painted: !!(hit && head.contains(hit)),
          };
        });
        if (!note || !note.onScreen || !note.painted) {
          fail("following the mark under the total does not leave its note readable at 390px",
            note ? `the note's heading is at ${note.top}px, and ${note.painted ? "is" : "is NOT"} what is painted there`
              : "there is no note on the page");
        }
      }
      await page.close();
    }

    /* ---------------------------------------------------------------- */
    /* Nothing spills sideways on the narrowest screen anyone brings     */
    /* ---------------------------------------------------------------- */
    // 320px is the floor: an iPhone SE, and the width below which nothing is
    // promised. The sheet is opened as well as filled, because a shut sheet
    // hides the contribution rows and their steppers - the widest things on
    // the page at this size, and the last things anybody looks at.
    {
      const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector(".grid button", { timeout: 15000 });
      await settle(page);

      for (const state of ["empty", "filled", "filled, sheet open"]) {
        if (state === "filled") await choose(page, 3);
        if (state === "filled, sheet open") {
          await page.locator("#panel-toggle").click();
          await page.waitForTimeout(450);
          await settle(page);
        }
        const over = await spill(page);
        if (over.over > 0) {
          fail(`the page is wider than the window at 320px (${state})`,
            `${over.over}px of overflow, first past the edge: ${over.culprit}`);
        }
        if (state === "filled, sheet open") {
          const line = await methodLine(page);
          if (!(line.shown && line.painted && line.inside)) {
            fail("the method's uncertainty cannot be read in the open sheet at 320px", lineReport(line));
          }
        }
      }
      await page.close();
    }

    /* ---------------------------------------------------------------- */
    /* The table adds by row, and the keyboard path still walks it       */
    /* ---------------------------------------------------------------- */
    // WP8: a card is one button covering its whole area, and the table has to
    // add the same way - not only from the small name button inside a row -
    // or the two views keep the mode split this package exists to close. This
    // is the fault class no source-reading check can see: a row that looks
    // clickable - it has a hover state and a pointer cursor - while a click on
    // anything besides the name button does nothing.
    {
      const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector(".grid button", { timeout: 15000 });
      await page.locator('#views button[data-mode="table"]').click();
      await page.waitForSelector(".table tbody tr", { timeout: 15000 });
      await settle(page);

      const rows = await page.locator(".table tbody tr").count();
      if (rows < 200) {
        fail("not all of the increments rendered as table rows", `${rows} rows, expected 236`);
      }

      // Rows are addressed by position below. That is safe rather than lucky:
      // with no search running the sections are the category files in order, and
      // the first of them holds 44 rows, so indices 0 to 8 are all inside it.
      const firstRow = page.locator(".table tbody tr").first();

      // A cell that carries no button of its own - clicking it must still add,
      // which is the entire point of this package. Asked of the row's own count
      // badge rather than of the running total, because a first value of zero
      // would leave the total unmoved and pass this for the wrong reason.
      await firstRow.locator("td.num").first().click();
      await settle(page);
      const afterCellClick = {
        badge: await firstRow.locator(".tally").textContent().catch(() => null),
        picked: ((await firstRow.getAttribute("class")) ?? "").includes("picked"),
      };
      if (afterCellClick.badge !== "×1" || !afterCellClick.picked) {
        fail("clicking a table row's value cell does not add its increment",
          `the row's count badge reads ${JSON.stringify(afterCellClick.badge)}, expected "×1", ` +
          `and the row ${afterCellClick.picked ? "is" : "is NOT"} marked picked`);
      }
      const kjAfterCellClick = await page.textContent("#kj");

      // A second cell, in the same row: this is a count stepper, not a
      // one-shot toggle, so the same row clicked again adds a second one.
      await firstRow.locator("td.soft").first().click();
      await settle(page);
      const tallyAfterSecondClick = await firstRow.locator(".tally").textContent().catch(() => null);
      if (tallyAfterSecondClick !== "×2") {
        fail("clicking a table row a second time does not step its count",
          `the count badge reads ${JSON.stringify(tallyAfterSecondClick)}, expected "×2"`);
      }

      // The count badge takes one back - clicking it must not also register as
      // a click on the row, which would leave the count exactly where it
      // started instead of falling to one.
      await firstRow.locator(".tally").click();
      await page.waitForTimeout(120);
      const tallyAfterBadgeClick = await firstRow.locator(".tally").count();
      const kjAfterBadgeClick = await page.textContent("#kj");
      if (tallyAfterBadgeClick !== 1 || kjAfterBadgeClick !== kjAfterCellClick) {
        fail("the table row's count badge does not take exactly one back",
          `${tallyAfterBadgeClick} badge(s) remain and the total reads ` +
          `${JSON.stringify(kjAfterBadgeClick)}, expected the pre-second-click total ` +
          `${JSON.stringify(kjAfterCellClick)}`);
      }

      // The keyboard path: focus a row's name button, walk with an arrow key to
      // the very next row - not merely somewhere else, which a row skipped
      // would also satisfy - and add with the same "+" the card grid answers to.
      const nameButton = (index) =>
        page.locator(".table tbody tr").nth(index).locator("th button").first();
      await nameButton(2).focus();
      await page.keyboard.press("ArrowDown");
      const walked = await nameButton(3).evaluate((button) => ({
        landed: document.activeElement === button,
        text: document.activeElement?.textContent ?? null,
        wanted: button.textContent,
      }));
      if (!walked.landed) {
        fail("ArrowDown does not walk from one table row to the next",
          `from the third row's name, focus should reach ${JSON.stringify(walked.wanted)} ` +
          `and reads ${JSON.stringify(walked.text)}`);
      }

      await page.keyboard.press("+");
      await settle(page);
      const badgeAfterKeyboardAdd = await page.locator(".table tbody tr").nth(3)
        .locator(".tally").textContent().catch(() => null);
      if (badgeAfterKeyboardAdd !== "×1") {
        fail("pressing + on a focused table row does not add it",
          `the fourth row's count badge reads ${JSON.stringify(badgeAfterKeyboardAdd)}, expected "×1"`);
      }

      // Making the whole row a target must not turn copying into adding. A drag
      // across a cell ends in a click on it, so without a guard the reader who
      // selects a value to paste elsewhere changes the total without being
      // told, and the re-render that follows takes the selection away too.
      const dragCell = page.locator(".table tbody tr").nth(5).locator("td.soft").nth(1);
      const dragBox = await dragCell.boundingBox();
      const kjBeforeDrag = await page.textContent("#kj");
      await page.mouse.move(dragBox.x + 4, dragBox.y + dragBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(dragBox.x + dragBox.width - 4, dragBox.y + dragBox.height / 2, { steps: 8 });
      await page.mouse.up();
      await settle(page);
      const kjAfterDrag = await page.textContent("#kj");
      const dragSelection = await page.evaluate(() => String(getSelection()));
      if (kjAfterDrag !== kjBeforeDrag) {
        fail("selecting the text of a table cell adds its increment",
          `total read ${JSON.stringify(kjBeforeDrag)} before the drag and ${JSON.stringify(kjAfterDrag)} after`);
      }
      if (!dragSelection) {
        fail("selecting the text of a table cell does not leave it selected",
          "the selection is empty after the drag");
      }

      // A click on a cell has to leave the keyboard something to act on.
      // Pressing a card focuses it, so + adds another straight after; a row
      // takes no focus of its own, and until it handed focus to its name button
      // + did nothing after a row was clicked - the same mode split, by key.
      const focusRow = page.locator(".table tbody tr").nth(8);
      await focusRow.locator("td.num").first().click();
      await settle(page);
      await page.keyboard.press("+");
      await settle(page);
      const clickThenPlus = {
        badge: await focusRow.locator(".tally").textContent().catch(() => null),
        onName: await focusRow.locator("th button").first()
          .evaluate((button) => document.activeElement === button),
      };
      if (clickThenPlus.badge !== "×2" || !clickThenPlus.onName) {
        fail("after a table row is clicked, + does not add another of it",
          `the row's count badge reads ${JSON.stringify(clickThenPlus.badge)}, expected "×2", ` +
          `and focus ${clickThenPlus.onName ? "is" : "is NOT"} on the row's name`);
      }

      await page.close();
    }

    /* ---------------------------------------------------------------- */
    /* Adding from a scrolled table keeps the reader's place             */
    /* ---------------------------------------------------------------- */
    // A table is wider than a phone, so .table-wrap scrolls sideways, and every
    // add replaces the markup inside it. A reader who had scrolled across to
    // read the source column was put back at the first column on every tap -
    // invisible on a desktop, where nothing scrolls, and invisible to every
    // check that reads the source.
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector(".grid button", { timeout: 15000 });
      await page.locator('#views button[data-mode="table"]').click();
      await page.waitForSelector(".table tbody tr", { timeout: 15000 });
      await settle(page);

      // Two tables, scrolled to different places. Both are needed: while the
      // sections stay where they are, restoring by position and restoring by
      // section produce identical results, so one table proves nothing about
      // which of the two renderLibrary() does.
      const wraps = page.locator(".table-wrap");
      await wraps.nth(0).evaluate((box) => { box.scrollLeft = 120; });
      await wraps.nth(1).evaluate((box) => { box.scrollLeft = 60; });
      await settle(page);
      const scrolled = await wraps.evaluateAll((boxes) =>
        boxes.map((box) => ({ section: box.dataset.section, left: box.scrollLeft })));

      if (scrolled.length < 2 || scrolled[0].left < 1 || scrolled[1].left < 1) {
        fail("the tables do not scroll sideways at 390px, so this cannot be checked",
          `${scrolled.length} table(s), at ${scrolled.map((s) => s.left).join("px, ")}px - ` +
          "they may have stopped being wider than the screen, which would make this vacuous");
      } else {
        // Narrowing to one category is what tells the two apart. The surviving
        // table was the second one; it now sits where the first one did, and it
        // must keep its own 60px rather than inherit the first's 120px.
        const second = scrolled[1];
        await page.locator(`#chips button[data-file="${second.section}"]`).click();
        await settle(page);
        const narrowed = await wraps.evaluateAll((boxes) =>
          boxes.map((box) => ({ section: box.dataset.section, left: box.scrollLeft })));

        if (narrowed.length !== 1 || narrowed[0].section !== second.section) {
          fail("narrowing to one category did not leave exactly that category's table",
            `left ${JSON.stringify(narrowed)}, expected only ${JSON.stringify(second.section)}`);
        } else if (Math.abs(narrowed[0].left - second.left) > 1) {
          fail("a narrowed table is given another section's scroll position",
            `${second.section} sat ${second.left}px across and reads ${narrowed[0].left}px ` +
            `once it is the only table, where the first table sat ${scrolled[0].left}px`);
        }

        // Clicked by coordinate, not through a locator: Playwright scrolls an
        // element into view before clicking it, which would move the very thing
        // being measured. The third row, so the sheet at the foot cannot cover
        // it - and never a link, because following a citation is deliberately
        // not an add, so a point that landed on one would fail for that reason
        // rather than for the scroll.
        const point = await wraps.first().evaluate((box) => {
          const rect = box.getBoundingClientRect();
          const row = box.querySelector("tbody tr:nth-child(3)");
          const rowRect = row.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rowRect.top + rowRect.height / 2;
          const hit = document.elementFromPoint(x, y);
          return { x, y, onCell: !!(hit && hit.closest("td") && !hit.closest("a")) };
        });

        if (!point.onCell) {
          fail("could not find a table cell to click in the scrolled table at 390px",
            "nothing that is a cell, and not a link, is painted at " +
            `${Math.round(point.x)},${Math.round(point.y)}`);
        } else {
          const before = await wraps.first().evaluate((box) => box.scrollLeft);
          await page.mouse.click(point.x, point.y);
          await settle(page);
          const after = await wraps.first().evaluate((box) => ({
            left: box.scrollLeft,
            picked: !!box.querySelector("tbody tr.picked"),
          }));
          if (!after.picked || Math.abs(after.left - before) > 1) {
            fail("adding from a sideways-scrolled table row loses the reader's place",
              `the table sat ${before}px across and reads ${after.left}px after the add, ` +
              `and a row ${after.picked ? "was" : "was NOT"} added`);
          }
        }
      }
      await page.close();
    }

    /* ---------------------------------------------------------------- */
    /* A citation link in a table row is followed, not added             */
    /* ---------------------------------------------------------------- */
    // No row carries a Source yet, so no row holds a link - which is why this
    // gives one row a reference here rather than waiting for the data to. Once
    // a value is cited, its mark sits inside a row that adds on any click, and
    // without an exclusion of its own following the citation changed the total.
    {
      const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
      await page.route("**/dist/increments.json*", async (route) => {
        const response = await route.fetch();
        const artifact = await response.json();
        artifact.increments[0].ref = artifact.references[0]?.key ?? null;
        await route.fulfill({ response, json: artifact });
      });
      await page.goto(base, { waitUntil: "load" });
      await page.waitForSelector(".grid button", { timeout: 15000 });
      await page.locator('#views button[data-mode="table"]').click();
      await page.waitForSelector(".table tbody tr", { timeout: 15000 });
      await settle(page);

      const link = page.locator(".table tbody tr").first().locator(".cite-mark a");
      const links = await link.count();
      if (links !== 1) {
        fail("a table row given a reference shows no citation link to follow",
          `${links} links in the first row; the artifact may hold no reference to cite`);
      } else {
        const kjBeforeLink = await page.textContent("#kj");
        await link.click();
        await page.waitForTimeout(120);
        const kjAfterLink = await page.textContent("#kj");
        if (kjAfterLink !== kjBeforeLink) {
          fail("following a citation link in a table row adds its increment",
            `total read ${JSON.stringify(kjBeforeLink)} before and ${JSON.stringify(kjAfterLink)} after`);
        }
      }
      await page.close();
    }
  } catch (error) {
    // A page too broken to measure throws instead of answering, and a stack
    // trace is a worse bug report than a sentence. It still exits non-zero.
    fail("the page could not be measured", String(error).split("\n")[0]);
  } finally {
    await browser.close();
    server.close();
  }

  return report();
}

function report() {
  if (problems.length) {
    console.error(`${problems.length} problem(s) found:\n`);
    for (const problem of problems) console.error(`  ${problem}\n`);
    console.error("The page parses and passes every other check. It is still wrong.");
    return 1;
  }

  console.log("OK - the page renders: the total is on screen at 390px and beside the " +
    "grid at 1180px, the sheet holds still, and nothing spills sideways at 320px. " +
    "The method's uncertainty reads under the total at 320, 390 and 1180px, and its " +
    "mark leads to a note that is not covered at 390px. A table row adds and steps " +
    "its count by clicking anywhere in it, + adds another after a click, neither " +
    "selecting a cell's text nor following its citation adds it, the arrow keys " +
    "and + still walk and add across rows, and adding from a table scrolled " +
    "sideways leaves it where the reader put it.");
  return 0;
}

process.exit(await main());
