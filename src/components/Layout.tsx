import { Link, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import client from "../api/client";
import useChildren from "../hooks/useChildren";

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
        style={{ fontWeight: current === "en" ? "bold" : "normal", textDecoration: current === "en" ? "underline" : "none" }}
      >
        EN
      </button>
      <span>|</span>
      <button
        type="button"
        onClick={() => switchTo("ru")}
        style={{ fontWeight: current === "ru" ? "bold" : "normal", textDecoration: current === "ru" ? "underline" : "none" }}
      >
        RU
      </button>
    </span>
  );
}

export default function Layout() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  useChildren();

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
              <button type="button" onClick={() => navigate("/chart")}>
                {t("nav.chart")}
              </button>
              <button type="button" onClick={() => navigate("/add-event")}>
                {t("nav.addEvent")}
              </button>
              <button type="button" onClick={() => navigate("/stats")}>
                {t("nav.stats")}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <LangToggle />
              <button type="button" onClick={() => navigate("/child-settings")}>
                {t("nav.settings")}
              </button>
              <button type="button" onClick={handleLogout}>
                {t("nav.logout")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link to="/login">{t("nav.login")}</Link> | <Link to="/register">{t("nav.register")}</Link>
            </div>
            <LangToggle />
          </>
        )}
      </nav>
      <hr />
      <Outlet />
    </div>
  );
}
