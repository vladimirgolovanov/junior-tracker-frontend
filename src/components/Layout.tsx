import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { useThemeStore } from "../store/theme";
import client from "../api/client";
import useChildren from "../hooks/useChildren";

const navBtnStyle: React.CSSProperties = {
  background: "none", border: "none", padding: 0,
  cursor: "pointer", color: "inherit", font: "inherit", textAlign: "left",
};

function LangToggle() {
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

function ThemeToggle() {
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

export default function Layout() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useChildren();

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleLogout() {
    await client.POST("/auth/logout");
    logout();
    navigate("/login");
  }

  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {token ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>{t("nav.appName")}</span>
              <Link to="/chart">{t("nav.chart")}</Link>
              <Link to="/stats">{t("nav.stats")}</Link>
            </div>
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                type="button"
                style={{ ...navBtnStyle, fontSize: "1.3em" }}
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Menu"
              >
                <i className="fa-regular fa-face-surprise" />
              </button>
              {menuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "100%",
                  background: "var(--menu-bg)", border: "1px solid var(--border)",
                  padding: "8px 12px", display: "flex", flexDirection: "column",
                  gap: 8, minWidth: 120, zIndex: 100, whiteSpace: "nowrap",
                }}>
                  <LangToggle />
                  <ThemeToggle />
                  <Link to="/child-settings" onClick={() => setMenuOpen(false)}>
                    {t("nav.settings")}
                  </Link>
                  <button type="button" style={navBtnStyle} onClick={() => { handleLogout(); setMenuOpen(false); }}>
                    {t("nav.logout")}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link to="/login">{t("nav.login")}</Link> | <Link to="/register">{t("nav.register")}</Link>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <LangToggle />
              <span style={{ fontSize: "0.85em" }}>|</span>
              <ThemeToggle />
            </div>
          </>
        )}
      </nav>
      <hr />
      <Outlet />
    </div>
  );
}
