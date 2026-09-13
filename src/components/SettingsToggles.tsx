import { useTranslation } from "react-i18next";
import { useThemeStore } from "../store/theme";
import { navBtnStyle } from "./navBtnStyle";

export function LangToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  function switchTo(lang: string) {
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
  }

  return (
    <span style={{ display: "flex", gap: 4, fontSize: "0.85em" }}>
      <button
        type="button"
        onClick={() => switchTo("en")}
        style={{ ...navBtnStyle, fontWeight: current === "en" ? "bold" : "normal", textDecoration: current === "en" ? "underline" : "none" }}
      >
        EN
      </button>
      <span>|</span>
      <button
        type="button"
        onClick={() => switchTo("ru")}
        style={{ ...navBtnStyle, fontWeight: current === "ru" ? "bold" : "normal", textDecoration: current === "ru" ? "underline" : "none" }}
      >
        RU
      </button>
    </span>
  );
}

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore();
  const opts: { key: "light" | "dark" | "system"; label: string }[] = [
    { key: "light", label: "☀" },
    { key: "dark", label: "☾" },
    { key: "system", label: "Auto" },
  ];
  return (
    <span style={{ display: "flex", gap: 4, fontSize: "0.85em" }}>
      {opts.map((o, i) => (
        <span key={o.key} style={{ display: "flex", gap: 4 }}>
          {i > 0 && <span>|</span>}
          <button
            type="button"
            onClick={() => setMode(o.key)}
            style={{ ...navBtnStyle, fontWeight: mode === o.key ? "bold" : "normal", textDecoration: mode === o.key ? "underline" : "none" }}
          >
            {o.label}
          </button>
        </span>
      ))}
    </span>
  );
}
