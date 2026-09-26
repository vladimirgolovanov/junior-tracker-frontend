import { create } from "zustand";
import { loadList } from "./loadList";
import { readSnapshot, writeSnapshot } from "../api/snapshot";

export interface Child {
  id: number;
  name: string;
  timezone?: string;
  day_start?: string | null;
  day_end?: string | null;
}

const flag = { fetching: false };
const SNAP_KEY = "children";

interface ChildrenState {
  children: Child[];
  loaded: boolean;
  load: () => void;
  reset: () => void;
}

export const useChildrenStore = create<ChildrenState>((set, get) => ({
  // Seed from the last-good snapshot so firstChildId is available offline (it
  // unblocks the cached dashboard/status). `loaded` stays false so a network
  // fetch still runs to refresh the list when the connection is back.
  children: readSnapshot<Child[]>(SNAP_KEY) ?? [],
  loaded: false,
  load: () => {
    if (get().loaded) return;
    loadList<Child>("/api/children/", flag, (children) => {
      set({ children, loaded: true });
      writeSnapshot(SNAP_KEY, children);
    });
  },
  reset: () => {
    flag.fetching = false;
    set({ children: [], loaded: false });
  },
}));
