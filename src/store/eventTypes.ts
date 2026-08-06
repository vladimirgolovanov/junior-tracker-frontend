import { create } from "zustand";
import { authedFetch } from "../api/client";

export interface EventType {
  id: number;
  name: string;
  format: string;
  color: string | null;
  parent_id: number | null;
  show_in_filters: boolean;
  show_in_last_events: boolean;
  volume_input: boolean;
  describe_input: boolean;
}

let isFetching = false;

interface EventTypesState {
  eventTypes: EventType[];
  loadedForChildId: number | null;
  load: (childId: number) => void;
  reset: () => void;
}

export const useEventTypesStore = create<EventTypesState>((set, get) => ({
  eventTypes: [],
  loadedForChildId: null,
  load: (childId: number) => {
    if (get().loadedForChildId === childId || isFetching) return;
    isFetching = true;
    const url = new URL("/api/event_types/", window.location.origin);
    url.searchParams.set("child_id", String(childId));
    authedFetch(url.toString())
      .then((r) => r.json())
      .then((data: EventType[]) => {
        if (Array.isArray(data)) {
          set({ eventTypes: data, loadedForChildId: childId });
        }
      })
      .catch(() => {})
      .finally(() => { isFetching = false; });
  },
  reset: () => {
    isFetching = false;
    set({ eventTypes: [], loadedForChildId: null });
  },
}));
