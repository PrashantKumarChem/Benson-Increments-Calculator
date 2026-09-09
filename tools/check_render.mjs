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
 * full 100% down and off the screen - and this file does not catch it. It was
 * tried. Headless Chromium resolves that transform correctly; the bug needs a
 * compositor that does not re-resolve a percentage when the custom property
 * inside the calc changes, which is the browser on a desk and not the one
 * here. A headless render is a much better check than reading the source and
 * still not the same thing as looking.
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
 * its CSVs with fetch, so file:// will not do, and a dependency for thirty
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
    "grid at 1180px, the sheet holds still, and nothing spills sideways at 320px.");
  return 0;
}

process.exit(await main());
