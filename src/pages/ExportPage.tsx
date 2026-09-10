import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { useChildrenStore } from "../store/children";
import { authedFetch } from "../api/client";

interface ExportJob {
  id: number;
  type: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

// Backend expects full ISO 8601 (UTC) datetimes; a bare date maps to that day's
// UTC midnight. No local-timezone math here — that lives on the backend now.
function toIso(date: string): string {
  return `${date}T00:00:00Z`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function fmtRange(from: string | null, to: string | null): string {
  if (!from && !to) return "—";
  const fmt = (s: string) => new Date(s).toLocaleDateString();
  return `${from ? fmt(from) : "…"} – ${to ? fmt(to) : "…"}`;
}

// Content-Disposition -> filename, tolerant of `filename*=UTF-8''...` and quotes.
function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

export default function ExportPage() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const children = useChildrenStore((s) => s.children);

  const [childId, setChildId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("events");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});

  useEffect(() => {
    if (children.length > 0 && childId === null) {
      setChildId(children[0].id);
    }
  }, [children, childId]);

  function loadHistory() {
    if (childId === null || !token) return;
    setLoading(true);
    setError(null);
    authedFetch(`/api/v2/children/${childId}/exports`)
      .then((r) => {
        if (!r.ok) throw new Error(t("export_errorStatus", { status: r.status }));
        return r.json();
      })
      .then((data: ExportJob[]) => {
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setJobs(list);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("export_networkError")))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadHistory, [childId, token]);

  async function createExport(e: React.FormEvent) {
    e.preventDefault();
    if (childId === null) return;
    setCreating(true);
    setCreateError(null);
    try {
      const body: { type: string; from?: string; to?: string } = { type };
      if (from) body.from = toIso(from);
      if (to) body.to = toIso(to);
      const r = await authedFetch(`/api/v2/children/${childId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        setCreateError(b?.detail ?? t("export_errorStatus", { status: r.status }));
      } else {
        loadHistory();
      }
    } catch {
      setCreateError(t("export_networkError"));
    } finally {
      setCreating(false);
    }
  }

  async function downloadJob(job: ExportJob) {
    if (childId === null) return;
    setDownloadingId(job.id);
    setRowError((prev) => ({ ...prev, [job.id]: "" }));
    try {
      const r = await authedFetch(`/api/v2/children/${childId}/exports/${job.id}/download`);
      if (!r.ok) {
        const msg = r.status === 409 ? t("export_notReady") : t("export_errorStatus", { status: r.status });
        setRowError((prev) => ({ ...prev, [job.id]: msg }));
        return;
      }
      const blob = await r.blob();
      const filename = filenameFromDisposition(r.headers.get("Content-Disposition"), `export-${job.id}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setRowError((prev) => ({ ...prev, [job.id]: t("export_networkError") }));
    } finally {
      setDownloadingId(null);
    }
  }

  function statusLabel(status: string): string {
    const key = `export_status_${status}`;
    const label = t(key);
    return label === key ? status : label;
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2>{t("export_title")}</h2>
        {children.length > 1 && (
          <select value={childId ?? ""} onChange={(e) => setChildId(Number(e.target.value))}>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <section style={{ marginBottom: 32 }}>
        <form onSubmit={createExport} style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <label>
            {t("export_type")}
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ display: "block", marginTop: 4 }}>
              <option value="events">{t("export_typeEvents")}</option>
            </select>
          </label>
          <label>
            {t("export_from")}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ display: "block", marginTop: 4 }} />
          </label>
          <label>
            {t("export_to")}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ display: "block", marginTop: 4 }} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={creating || childId === null}>
            {creating ? t("export_creating") : t("export_create")}
          </button>
          {createError && <span style={{ color: "red" }}>{createError}</span>}
        </form>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3>{t("export_history")}</h3>
          <button type="button" onClick={loadHistory} disabled={loading || childId === null}>
            {t("export_refresh")}
          </button>
        </div>

        {loading && <p>{t("export_loading")}</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {!loading && jobs.length === 0 && !error && <p>{t("export_noHistory")}</p>}

        {jobs.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t("export_type")}</th>
                <th style={th}>{t("export_colRange")}</th>
                <th style={th}>{t("export_colStatus")}</th>
                <th style={th}>{t("export_colCreated")}</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td style={td}>{job.type === "events" ? t("export_typeEvents") : job.type}</td>
                  <td style={td}>{fmtRange(job.date_from, job.date_to)}</td>
                  <td style={td}>
                    {statusLabel(job.status)}
                    {job.status === "failed" && job.error && (
                      <div style={{ color: "red", fontSize: 11 }}>{job.error}</div>
                    )}
                  </td>
                  <td style={td}>{fmtDateTime(job.created_at)}</td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => downloadJob(job)}
                      disabled={job.status !== "completed" || downloadingId === job.id}
                    >
                      {downloadingId === job.id ? t("export_downloading") : t("export_download")}
                    </button>
                    {rowError[job.id] && (
                      <div style={{ color: "red", fontSize: 11 }}>{rowError[job.id]}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  borderBottom: "1px solid var(--border-muted)",
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: "4px 8px",
  verticalAlign: "top",
};
