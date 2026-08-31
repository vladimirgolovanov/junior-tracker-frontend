import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";

// The register endpoint is unauthenticated (no token yet) and lives on the v2
// backend (proxied /api/v2 -> :8001), so we call it with a plain fetch().
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

type Mode = "create" | "join";

// Query-string param that carries an invite/join code, e.g. /register?code=ABC123
export const JOIN_CODE_PARAM = "code";

// Shape of a backend validation error, e.g.
// {"title":"Validation failed","status":422,"errors":{"timezone":"Field \"timezone\" is required."}}
type ApiError = {
  detail?: unknown;
  title?: string;
  errors?: Record<string, unknown>;
};

type FieldError = { field: string; message: string };

// Successful /api/v2/register response carries a token, letting us log the user in directly.
type RegisterSuccess = { access_token: string };

// Flatten the backend's { field: message } map into a renderable list.
function parseFieldErrors(errors: ApiError["errors"]): FieldError[] {
  if (!errors || typeof errors !== "object") return [];
  return Object.entries(errors).map(([field, message]) => ({
    field,
    message: typeof message === "string" ? message : String(message),
  }));
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setToken = useAuthStore((s) => s.setToken);

  const initialCode = searchParams.get(JOIN_CODE_PARAM)?.trim() ?? "";

  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const timezones = useMemo<string[]>(() => {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    return supported ? supported("timeZone") : [browserTz];
  }, [browserTz]);

  const today = new Date().toISOString().slice(0, 10);

  // Arrived via an invite link → this is a join, no choice to offer.
  const locked = initialCode !== "";

  const [mode, setMode] = useState<Mode>(initialCode ? "join" : "create");
  const [childName, setChildName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [timezone, setTimezone] = useState(browserTz);
  const [joinCode, setJoinCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFieldErrors([]);

    const fd = new FormData(e.currentTarget);
    const baseBody = {
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      is_active: true,
      is_superuser: false,
      is_verified: false,
    };

    // The child fields ride along with the register call at the top level:
    const body =
      mode === "create"
        ? {
            ...baseBody,
            child_name: childName,
            timezone,
            birthdate, // "YYYY-MM-DD"
          }
        : {
            ...baseBody,
            join_code: joinCode.trim(),
          };

    const res = await fetch(`${API_BASE}/api/v2/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const apiErr = (await res.json().catch(() => ({}))) as ApiError;
      const parsed = parseFieldErrors(apiErr.errors);
      if (parsed.length > 0) {
        setFieldErrors(parsed);
        setError(apiErr.title ?? t("register_failed"));
      } else {
        const detail = apiErr.detail;
        setError(typeof detail === "string" ? detail : t("register_failed"));
      }
      return;
    }

    // The register response includes an access token — log the user in immediately
    // instead of bouncing them to the login page.
    const data = (await res.json()) as RegisterSuccess;
    setToken(data.access_token);
    navigate("/chart");
  }

  return (
    <div className="auth-page">
      <h1>{t("register_title")}</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span className="auth-field-label">{t("register_email")}</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="auth-field">
          <span className="auth-field-label">{t("register_password")}</span>
          <input name="password" type="password" autoComplete="new-password" required minLength={3} />
        </label>

        {!locked && (
          <div className="auth-field">
            <span className="auth-field-label">{t("register_childMode")}</span>
            <div className="seg">
              <button
                type="button"
                className={mode === "create" ? "seg-btn active" : "seg-btn"}
                onClick={() => setMode("create")}
              >
                {t("register_createChild")}
              </button>
              <button
                type="button"
                className={mode === "join" ? "seg-btn active" : "seg-btn"}
                onClick={() => setMode("join")}
              >
                {t("register_joinChild")}
              </button>
            </div>
          </div>
        )}

        {locked ? (
          <p className="auth-note">{t("register_joiningWithCode", { code: initialCode })}</p>
        ) : mode === "create" ? (
          <>
            <label className="auth-field">
              <span className="auth-field-label">{t("register_childName")}</span>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                required
              />
            </label>
            <label className="auth-field">
              <span className="auth-field-label">{t("register_timezone")}</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                required
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              <span className="auth-field-label">{t("register_birthdate")}</span>
              <input
                type="date"
                value={birthdate}
                max={today}
                onChange={(e) => setBirthdate(e.target.value)}
                required
              />
            </label>
          </>
        ) : (
          <label className="auth-field">
            <span className="auth-field-label">{t("register_joinCode")}</span>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
          </label>
        )}

        {error && <p className="auth-error">{error}</p>}
        {fieldErrors.length > 0 && (
          <ul className="auth-error-list">
            {fieldErrors.map(({ field, message }) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        )}
        <button type="submit" className="btn btn-primary">{t("register_submit")}</button>
      </form>
      <p className="auth-alt">
        {t("register_hasAccount")} <Link to="/login">{t("register_login")}</Link>
      </p>
    </div>
  );
}
