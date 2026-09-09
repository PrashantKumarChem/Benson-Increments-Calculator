/**
 * Light, dark, and the third state that matters: not having said.
 *
 * The rules live here rather than in app.js because they are decisions, not
 * wiring, and because they are written twice. index.html carries four lines of
 * inline script that read the stored choice before the first paint - a module
 * is deferred until after it, so setting the theme there would show the wrong
 * colours for a frame and then flip them. An inline script cannot import, so
 * that copy cannot be removed.
 *
 * What can be removed is the silence. The key and the two values are exported
 * here, app.js uses them rather than repeating them, and tools/theme.test.mjs
 * reads index.html and fails if its inline script and this file stop agreeing.
 * The duplication is forced; being unaware of it is not.
 *
 * IF YOU CHANGE ANYTHING IN THIS FILE, CHANGE THE INLINE SCRIPT IN index.html.
 */

/** Where the choice is remembered. */
export const THEME_KEY = "theme";
export const LIGHT = "light";
export const DARK = "dark";

/**
 * Is this a theme the page will honour?
 *
 * Anything else means no choice has been made, which is a real state and not
 * an error: it is how a reader who has never pressed the button keeps
 * following their machine, including when the machine changes its mind at
 * sunset. The inline script applies the same rule before the first paint,
 * which is why nothing but these two ever reaches the attribute.
 */
export const isTheme = (value) => value === LIGHT || value === DARK;

/**
 * Which theme is actually in force.
 *
 * `chosen` is the data-theme attribute, absent when nothing has been chosen;
 * `systemPrefersDark` is what the machine says. Read from the theme in force
 * rather than from the stored value, because until the button is pressed there
 * is no stored value - only what the system is doing.
 */
export function isDark(chosen, systemPrefersDark) {
  return isTheme(chosen) ? chosen === DARK : Boolean(systemPrefersDark);
}

/** The theme pressing the button switches to, which is the other one. */
export const nextTheme = (dark) => (dark ? LIGHT : DARK);

/**
 * What the button should say it does.
 *
 * Named for where it goes rather than for what it is: this is the accessible
 * label, and the icon beside it shows the same thing - the one you are
 * switching to, not the one you are in.
 */
export const themeLabel = (dark) =>
  (dark ? "Switch to light theme" : "Switch to dark theme");
