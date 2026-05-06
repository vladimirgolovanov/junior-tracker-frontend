import { create } from "zustand";

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  setToken: (token) => {
    localStorage.setItem("token", token);
    set({ token });
  },
  logout: () => {
    localStorage.removeItem("token");
    import("./children").then(({ useChildrenStore }) => useChildrenStore.getState().reset());
    import("./eventTypes").then(({ useEventTypesStore }) => useEventTypesStore.getState().reset());
    set({ token: null });
  },
}));
