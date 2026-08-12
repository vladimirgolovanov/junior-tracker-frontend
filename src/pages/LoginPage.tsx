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
      setError(typeof detail === "string" ? detail : t("login.failed"));
      return;
    }

    const { access_token } = await r.json();
    setToken(access_token);
    navigate("/events");
  }

  return (
    <div>
      <h1>{t("login.title")}</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            {t("login.email")}
            <input name="username" type="email" required />
          </label>
        </div>
        <div>
          <label>
            {t("login.password")}
            <input name="password" type="password" required />
          </label>
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" className="btn btn-primary">{t("login.submit")}</button>
      </form>
      <p>
        {t("login.noAccount")} <Link to="/register">{t("login.register")}</Link>
      </p>
    </div>
  );
}
