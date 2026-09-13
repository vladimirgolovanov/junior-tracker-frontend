import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LangToggle, ThemeToggle } from "./SettingsToggles";
import appIcon from "../assets/app-icon.png";
import playBadge from "../assets/google-play-badge.png";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=me.golovanov.juniortracker";

// Shared full-screen layout for the login / register pages: a coloured brand
// panel on the left (desktop) or top (mobile), and the form on the right.
export default function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <img className="auth-brand-icon" src={appIcon} alt="" />
          <div className="auth-brand-logo">{t("nav_appName")}</div>
          <p className="auth-brand-tagline">{t("auth_tagline")}</p>
          <p className="auth-brand-desc">{t("auth_desc")}</p>
          <ul className="auth-brand-points">
            <li>{t("auth_point_sleep")}</li>
            <li>{t("auth_point_bottle")}</li>
            <li>{t("auth_point_share")}</li>
          </ul>
          <div className="auth-brand-stores">
            <a
              className="auth-brand-store"
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={playBadge} alt={t("auth_get_android")} />
            </a>
            {/* iOS — App Store. Заготовка: положите официальный бейдж App Store в
                src/assets, импортируйте его (например `import appStoreBadge from
                "../assets/app-store-badge.png"`), подставьте ссылку APP_STORE_URL
                и раскомментируйте (ключ auth_get_ios уже есть).
            <a
              className="auth-brand-store"
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={appStoreBadge} alt={t("auth_get_ios")} />
            </a>
            */}
          </div>
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
