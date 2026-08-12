import { authedFetch } from "../api/client";

// Loads a JSON array once, guarding against duplicate in-flight requests via the
// caller's `flag` (a plain object — synchronous, immune to React render batching).
// Silently ignores network errors and non-array responses. Shared by the
// cached-list stores.
export function loadList<T>(
  url: string,
  flag: { fetching: boolean },
  apply: (items: T[]) => void,
): void {
  if (flag.fetching) return;
  flag.fetching = true;
  authedFetch(url)
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) apply(data);
    })
    .catch(() => {})
    .finally(() => {
      flag.fetching = false;
    });
}
