import { create } from "zustand";
import { authedFetch } from "../api/client";

export interface Child {
  id: number;
  name: string;
  timezone?: string;
}

// module-level flag — synchronous, immune to React render batching
let isFetching = false;

interface ChildrenState {
  children: Child[];
  loaded: boolean;
  load: () => void;
  reset: () => void;
}

export const useChildrenStore = create<ChildrenState>((set, get) => ({
  children: [],
  loaded: false,
  load: () => {
    if (get().loaded || isFetching) return;
    isFetching = true;
    authedFetch("/api/children/")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          set({ children: data, loaded: true });
        }
      })
      .catch(() => {})
      .finally(() => { isFetching = false; });
  },
  reset: () => {
    isFetching = false;
    set({ children: [], loaded: false });
  },
}));
