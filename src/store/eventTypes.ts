import { create } from "zustand";
import { loadList } from "./loadList";

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

const flag = { fetching: false };

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
    if (get().loadedForChildId === childId) return;
    const url = new URL("/api/event_types/", window.location.origin);
    url.searchParams.set("child_id", String(childId));
    loadList<EventType>(url.toString(), flag, (eventTypes) => set({ eventTypes, loadedForChildId: childId }));
  },
  reset: () => {
    flag.fetching = false;
    set({ eventTypes: [], loadedForChildId: null });
  },
}));
