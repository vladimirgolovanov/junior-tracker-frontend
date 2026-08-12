import { create } from "zustand";
import { loadList } from "./loadList";

export interface Child {
  id: number;
  name: string;
  timezone?: string;
}

const flag = { fetching: false };

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
    if (get().loaded) return;
    loadList<Child>("/api/children/", flag, (children) => set({ children, loaded: true }));
  },
  reset: () => {
    flag.fetching = false;
    set({ children: [], loaded: false });
  },
}));
