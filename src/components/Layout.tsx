import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { useThemeStore } from "../store/theme";
import { authedFetch } from "../api/client";
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
  const closeMenu = () => setMenuOpen(false);
  useChildren();

  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function handleLogout() {
    await authedFetch("/auth/logout", { method: "POST" });
    logout();
    navigate("/login");
  }

  // The header keeps the same shape signed in or out (logo left, hamburger right);
  // only the drawer's contents differ.
  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to={token ? "/chart" : "/login"} className="logo">{t("nav_appName")}</Link>
        </div>
        <div>
          <button
            type="button"
            className="hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <i className="fa-solid fa-bars" />
          </button>
          <div
            className={`drawer-backdrop${menuOpen ? " open" : ""}`}
            onClick={closeMenu}
          />
          <aside className={`drawer${menuOpen ? " open" : ""}`}>
            <div className="drawer-header">
              <button
                type="button"
                className="drawer-close"
                onClick={closeMenu}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <nav className="drawer-nav">
              {token ? (
                <>
                  <Link to="/stats" onClick={closeMenu}>{t("nav_stats")}</Link>
                  <Link to="/invite" onClick={closeMenu}>{t("nav_invite")}</Link>
                  <Link to="/child-settings" onClick={closeMenu}>{t("nav_settings")}</Link>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={closeMenu}>{t("nav_login")}</Link>
                  <Link to="/register" onClick={closeMenu}>{t("nav_register")}</Link>
                </>
              )}
            </nav>
            <div className="drawer-footer">
              <LangToggle />
              <ThemeToggle />
              {token && (
                <button type="button" style={navBtnStyle} onClick={() => { handleLogout(); closeMenu(); }}>
                  {t("nav_logout")}
                </button>
              )}
            </div>
          </aside>
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
