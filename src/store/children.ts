import { create } from "zustand";

export interface Child {
  id: number;
  name: string;
  timezone?: string;
}

const CACHE_KEY = "children_cache";

function loadCache(): Child[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// module-level flag — synchronous, immune to React render batching
let isFetching = false;

interface ChildrenState {
  children: Child[];
  loaded: boolean;
  load: (token: string) => void;
  reset: () => void;
}

export const useChildrenStore = create<ChildrenState>((set, get) => ({
  children: loadCache(),
  loaded: loadCache().length > 0,
  load: (token: string) => {
    if (get().loaded || isFetching) return;
    isFetching = true;
    fetch("/api/children/", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          set({ children: data, loaded: true });
        }
      })
      .catch(() => {})
      .finally(() => { isFetching = false; });
  },
  reset: () => {
    isFetching = false;
    localStorage.removeItem(CACHE_KEY);
    set({ children: [], loaded: false });
  },
}));
