/** Tracks when menu navigation is temporarily torn down for a game start. */

/**
 * Has the chrome been torn down and not yet put back?
 *
 * This is the gate for the whole restore, and it is keyed on the teardown
 * ITSELF rather than on any separate signal that happens to correlate with it.
 * That distinction is load-bearing.
 *
 * The first version read the `in-game` body class, which looked equivalent and
 * was not: the teardown runs in `prestart.then(...)`, while setInGameSignal(true)
 * runs later in `join.then(...)`. For multiplayer those are two distinct server
 * messages with a real gap between them while terrain loads -- the
 * "prestart->start window" ClientGameRunner names. A leave inside that window
 * (Back, or a hash change, both reachable because `currentUrl` is also unset
 * until join) found the chrome torn down but the class never set, so nothing
 * restored. That is the bug OPE-255 exists to fix, arriving through a narrower
 * door.
 *
 * Keying on the teardown makes the gate true for exactly as long as there is
 * something to undo, whatever the join lifecycle is doing, and removes any
 * ordering constraint on the caller.
 */
let tornDown = false;

export function menuChromeIsTornDown(): boolean {
  return tornDown;
}

/** Hide the menu chrome for a game that is starting. */
export function hideMenuChrome(): void {
  tornDown = true;
}

/** Restore menu navigation after a game start was cancelled. */
export function restoreMenuChrome(): void {
  tornDown = false;
}
