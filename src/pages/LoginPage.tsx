import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
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

    const { data, error: err } = await client.POST("/auth/login", {
      body: {
        username: fd.get("username") as string,
        password: fd.get("password") as string,
        scope: "",
      },
      bodySerializer: (body) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(body as Record<string, string>)) {
          params.set(k, v);
        }
        return params.toString();
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (err) {
      setError(typeof err.detail === "string" ? err.detail : t("login.failed"));
      return;
    }

    setToken(data.access_token);
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
        <button type="submit">{t("login.submit")}</button>
      </form>
      <p>
        {t("login.noAccount")} <Link to="/register">{t("login.register")}</Link>
      </p>
    </div>
  );
}
