import { create } from "zustand";
import { authedFetch } from "../api/client";

export interface EventType {
  id: number;
  name: string;
  format: string;
  color: string | null;
  parent_id: number | null;
  show_in_filters: boolean;
  volume_input: boolean;
  describe_input: boolean;
}

const CACHE_KEY = "event_types_cache";

interface CacheEntry {
  childId: number;
  data: EventType[];
}

function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let isFetching = false;

interface EventTypesState {
  eventTypes: EventType[];
  loadedForChildId: number | null;
  load: (childId: number) => void;
  reset: () => void;
}

const cached = loadCache();

export const useEventTypesStore = create<EventTypesState>((set, get) => ({
  eventTypes: cached?.data ?? [],
  loadedForChildId: cached?.childId ?? null,
  load: (childId: number) => {
    if (get().loadedForChildId === childId || isFetching) return;
    isFetching = true;
    const url = new URL("/api/event_types/", window.location.origin);
    url.searchParams.set("child_id", String(childId));
    authedFetch(url.toString())
      .then((r) => r.json())
      .then((data: EventType[]) => {
        if (Array.isArray(data)) {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ childId, data }));
          set({ eventTypes: data, loadedForChildId: childId });
        }
      })
      .catch(() => {})
      .finally(() => { isFetching = false; });
  },
  reset: () => {
    isFetching = false;
    localStorage.removeItem(CACHE_KEY);
    set({ eventTypes: [], loadedForChildId: null });
  },
}));
