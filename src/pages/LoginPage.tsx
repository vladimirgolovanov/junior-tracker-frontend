import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authedFetch } from "../api/client";
import { useAuthStore } from "../store/auth";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = new URLSearchParams({
      username: fd.get("username") as string,
      password: fd.get("password") as string,
      scope: "",
    });

    const r = await authedFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!r.ok) {
      const detail = await r.json().then((b) => b?.detail).catch(() => undefined);
      setError(typeof detail === "string" ? detail : t("login_failed"));
      return;
    }

    const { access_token } = await r.json();
    setToken(access_token);
    navigate("/chart");
  }

  return (
    <div className="auth-page">
      <h1>{t("login_title")}</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span className="auth-field-label">{t("login_email")}</span>
          <input name="username" type="email" autoComplete="email" required />
        </label>
        <label className="auth-field">
          <span className="auth-field-label">{t("login_password")}</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn btn-primary">{t("login_submit")}</button>
      </form>
      <p className="auth-alt">
        {t("login_noAccount")} <Link to="/register">{t("login_register")}</Link>
      </p>
    </div>
  );
}
