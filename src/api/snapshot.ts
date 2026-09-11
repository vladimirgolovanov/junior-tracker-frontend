// Last-good API snapshots persisted to localStorage. They let the page render
// the previous "pulse" (dashboard / status / children) immediately on a cold
// reload, so a phone that opens the tab on a dead network shows the last known
// data instead of "No data". Written only on a valid 200; read once to seed
// state, then overwritten by the next successful response.

const PREFIX = "snap:";

export function readSnapshot<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Storage disabled (private mode) or corrupt JSON — behave as if empty.
    return null;
  }
}

export function writeSnapshot<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or disabled — a missing snapshot only costs a first-paint
    // fallback, so failing silently is fine.
  }
}
