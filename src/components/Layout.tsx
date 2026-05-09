import { Link, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import client from "../api/client";
import useChildren from "../hooks/useChildren";

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
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            <Link to="/login">{t("nav.login")}</Link> | <Link to="/register">{t("nav.register")}</Link>
          </>
        )}
      </nav>
      <hr />
      <Outlet />
    </div>
  );
}
