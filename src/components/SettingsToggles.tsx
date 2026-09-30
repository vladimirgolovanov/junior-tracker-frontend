import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../store/theme";
import { locales } from "../i18n";
import { navBtnStyle } from "./navBtnStyle";

export function LangToggle({ placement = "down" }: { placement?: "up" | "down" }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Reduce e.g. "en-US" to the base code and fall back to English.
  const base = i18n.language.split("-")[0];
  const current =
    locales.find((l) => l.code === i18n.language) ??
    locales.find((l) => l.code === base) ??
    locales[0];

  function switchTo(lang: string) {
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="lang-dd" ref={ref} style={{ fontSize: "0.85em" }}>
      <button
        type="button"
        className="lang-dd-trigger"
        style={navBtnStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {current.nativeName} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <span className={`lang-dd-menu ${placement}`} role="listbox">
          {locales.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`lang-dd-item${l.code === current.code ? " active" : ""}`}
              role="option"
              aria-selected={l.code === current.code}
              onClick={() => switchTo(l.code)}
            >
              {l.nativeName}
            </button>
          ))}
        </span>
      )}
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
