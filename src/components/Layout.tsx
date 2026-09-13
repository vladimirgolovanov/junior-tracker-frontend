import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { authedFetch } from "../api/client";
import useChildren from "../hooks/useChildren";
import { LangToggle, ThemeToggle } from "./SettingsToggles";
import { navBtnStyle } from "./navBtnStyle";

// Auth pages render their own full-screen layout (with their own EN/RU + theme
// toggles), so the shared header would only get in the way there.
const AUTH_ROUTES = ["/login", "/register"];

export default function Layout() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
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

  // Auth pages are self-contained full-screen layouts — no shared header.
  if (isAuthRoute) {
    return <Outlet />;
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
                  <div className="drawer-group">
                    <span className="drawer-group-title">{t("nav_stats")}</span>
                    <div className="drawer-subnav">
                      <Link to="/sleep" onClick={closeMenu}>{t("nav_sleep")}</Link>
                      <Link to="/bottle" onClick={closeMenu}>{t("nav_bottle")}</Link>
                    </div>
                  </div>
                  <Link to="/events" onClick={closeMenu}>{t("nav_events")}</Link>
                  <Link to="/export" onClick={closeMenu}>{t("nav_export")}</Link>
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
