import { create } from "zustand";

type ThemeMode = "light" | "dark" | "system";

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && getSystemDark());
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const saved = (localStorage.getItem("theme") as ThemeMode | null) ?? "system";

export const useThemeStore = create<ThemeStore>((set) => {
  applyTheme(saved);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useThemeStore.getState().mode === "system") applyTheme("system");
  });

  return {
    mode: saved,
    setMode(mode) {
      localStorage.setItem("theme", mode);
      applyTheme(mode);
      set({ mode });
    },
  };
});
