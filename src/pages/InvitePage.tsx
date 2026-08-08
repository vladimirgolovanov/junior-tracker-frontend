import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { authedFetch } from "../api/client";
import useChildren from "../hooks/useChildren";
import { JOIN_CODE_PARAM } from "./RegisterPage";

// Response of POST /api/v2/children/{id}/invites — a one-time join code and its expiry.
type Invite = { code: string; expires_at: string };

export default function InvitePage() {
  const { t } = useTranslation();
  const children = useChildren();

  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Default to the first child once the list loads.
  useEffect(() => {
    if (selectedChildId === null && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  // The register link the user forwards; RegisterPage reads the code from this param.
  const link = invite
    ? `${window.location.origin}/register?${JOIN_CODE_PARAM}=${encodeURIComponent(invite.code)}`
    : "";

  function selectChild(id: number) {
    setSelectedChildId(id);
    setInvite(null);
    setError(null);
    setCopied(false);
  }

  async function createInvite() {
    if (selectedChildId === null) return;
    setLoading(true);
    setError(null);
    setInvite(null);
    setCopied(false);
    try {
      const r = await authedFetch(`/api/v2/children/${selectedChildId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body?.detail ?? t("invite.errorStatus", { status: r.status }));
        return;
      }
      const data: Invite = await r.json();
      setInvite(data);
    } catch {
      setError(t("invite.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. non-secure context) — ignore silently.
    }
  }

  if (children.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px" }}>
        <h2>{t("invite.title")}</h2>
        <p>{t("invite.noChildren")}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px" }}>
      <h2>{t("invite.title")}</h2>

      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectChild(c.id)}
              style={{ fontWeight: selectedChildId === c.id ? "bold" : "normal" }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <p style={{ color: "var(--muted)" }}>{t("invite.hint")}</p>

      <button
        type="button"
        className="btn btn-primary"
        onClick={createInvite}
        disabled={loading || selectedChildId === null}
      >
        {loading ? t("invite.creating") : t("invite.create")}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {invite && (
        <section style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {t("invite.linkLabel")}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                style={{ flex: 1 }}
              />
              <button type="button" onClick={copyLink}>
                {copied ? t("invite.copied") : t("invite.copy")}
              </button>
            </div>
          </label>
          <div>
            {t("invite.code")}: <code>{invite.code}</code>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {t("invite.expiresAt", { when: new Date(invite.expires_at).toLocaleString() })}
          </div>
        </section>
      )}
    </div>
  );
}
