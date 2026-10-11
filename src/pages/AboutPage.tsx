import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { authedFetch } from "../api/client";

export default function AboutPage() {
  const { t } = useTranslation();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    setSent(false);
    try {
      const r = await authedFetch("/api/v2/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body?.detail ?? t("feedback_errorStatus", { status: r.status }));
        return;
      }
      setSent(true);
      setText("");
    } catch {
      setError(t("feedback_networkError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px" }}>
      <h2>{t("about_title")}</h2>

      {/* about_body is filled in later via i18n; pre-line keeps future paragraphs. */}
      <p style={{ whiteSpace: "pre-line", color: "var(--muted)" }}>{t("about_body")}</p>

      <section style={{ marginTop: 32 }}>
        <h3>{t("feedback_title")}</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (sent) setSent(false);
            }}
            placeholder={t("feedback_placeholder")}
            rows={5}
            style={{ resize: "vertical" }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !text.trim()}
          >
            {sending ? t("feedback_sending") : t("feedback_submit")}
          </button>
        </form>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {sent && <p style={{ color: "var(--muted)" }}>{t("feedback_success")}</p>}
      </section>
    </div>
  );
}
