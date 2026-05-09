import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    const { error: err } = await client.POST("/auth/register", {
      body: {
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        is_active: true,
        is_superuser: false,
        is_verified: false,
      },
    });

    if (err) {
      const detail = err.detail;
      setError(typeof detail === "string" ? detail : t("register.failed"));
      return;
    }

    navigate("/login");
  }

  return (
    <div>
      <h1>{t("register.title")}</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            {t("register.email")}
            <input name="email" type="email" required />
          </label>
        </div>
        <div>
          <label>
            {t("register.password")}
            <input name="password" type="password" required minLength={3} />
          </label>
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">{t("register.submit")}</button>
      </form>
      <p>
        {t("register.hasAccount")} <Link to="/login">{t("register.login")}</Link>
      </p>
    </div>
  );
}
