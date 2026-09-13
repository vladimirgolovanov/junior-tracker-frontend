import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LangToggle, ThemeToggle } from "./SettingsToggles";

// Shared full-screen layout for the login / register pages: a coloured brand
// panel on the left (desktop) or top (mobile), and the form on the right.
export default function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-logo">{t("nav_appName")}</div>
          <p className="auth-brand-tagline">{t("auth_tagline")}</p>
          <p className="auth-brand-desc">{t("auth_desc")}</p>
          <ul className="auth-brand-points">
            <li>{t("auth_point_sleep")}</li>
            <li>{t("auth_point_bottle")}</li>
            <li>{t("auth_point_share")}</li>
          </ul>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-panel-controls">
          <LangToggle />
          <ThemeToggle />
        </div>
        <div className="auth-panel-inner">{children}</div>
      </section>
    </div>
  );
}
