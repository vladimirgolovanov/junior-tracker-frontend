import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { useChildrenStore } from "../store/children";
import { useEventTypesStore } from "../store/eventTypes";
import { authedFetch } from "../api/client";

// Matches the backend EventItem. `occurred_at` is the child's naive local time
// (no timezone) — we edit it verbatim via <input type="datetime-local"> and never
// run it through Date/toISOString, so no timezone math happens on the frontend.
interface EventItem {
  id: number;
  occurred_at: string;
  child_id: number;
  description: string | null;
  volume: number | null;
  tg_message_id: number | null;
  event_type_id: number;
}

interface RowEdit {
  occurred_at: string;
  volume: string;
  description: string;
}

function localDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

// "2026-09-01T14:30:00" (or with a space separator) -> "2026-09-01T14:30" for the input.
function toInputValue(occurredAt: string): string {
  return occurredAt.replace(" ", "T").slice(0, 16);
}

// "2026-09-01T14:30" -> "2026-09-01T14:30:00"; leave alone if seconds already present.
function fromInputValue(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

function makeEdit(ev: EventItem): RowEdit {
  return {
    occurred_at: toInputValue(ev.occurred_at),
    volume: ev.volume == null ? "" : String(ev.volume),
    description: ev.description ?? "",
  };
}

export default function EventsPage() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const children = useChildrenStore((s) => s.children);
  const eventTypes = useEventTypesStore((s) => s.eventTypes);
  const loadEventTypes = useEventTypesStore((s) => s.load);

  const [childId, setChildId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState(() => localDateStr(-7));
  const [dateTo, setDateTo] = useState(() => localDateStr(0));

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rowEdits, setRowEdits] = useState<Record<number, RowEdit>>({});
  const [rowSaving, setRowSaving] = useState<Record<number, boolean>>({});
  const [rowDeleting, setRowDeleting] = useState<Record<number, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (children.length > 0 && childId === null) setChildId(children[0].id);
  }, [children, childId]);

  useEffect(() => {
    if (token && childId !== null) loadEventTypes(childId);
  }, [token, childId, loadEventTypes]);

  const typeById = new Map(eventTypes.map((et) => [et.id, et]));

  useEffect(() => {
    if (childId === null || !token) return;
    setLoading(true);
    setError(null);
    const url = new URL("/api/events/", window.location.origin);
    url.searchParams.set("child_id", String(childId));
    if (dateFrom) url.searchParams.set("date_from", dateFrom);
    if (dateTo) url.searchParams.set("date_to", dateTo);
    authedFetch(url.toString())
      .then((r) => {
        if (!r.ok) throw new Error(t("settings_errorStatus", { status: r.status }));
        return r.json();
      })
      .then((data: EventItem[]) => {
        const list = Array.isArray(data) ? [...data] : [];
        // occurred_at is an ISO-like naive string, so a lexicographic sort is chronological.
        list.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
        setEvents(list);
        setRowEdits(Object.fromEntries(list.map((ev) => [ev.id, makeEdit(ev)])));
        setRowErrors({});
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("settings_networkError")))
      .finally(() => setLoading(false));
  }, [childId, token, dateFrom, dateTo, t]);

  function updateRow(id: number, field: keyof RowEdit, value: string) {
    setRowEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveRow(id: number) {
    const edit = rowEdits[id];
    if (!edit) return;
    setRowSaving((prev) => ({ ...prev, [id]: true }));
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const body = {
        occurred_at: fromInputValue(edit.occurred_at),
        volume: edit.volume.trim() === "" ? null : Number(edit.volume),
        description: edit.description.trim() === "" ? null : edit.description,
      };
      const r = await authedFetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        setRowErrors((prev) => ({ ...prev, [id]: b?.detail ?? t("settings_errorStatus", { status: r.status }) }));
      } else {
        const updated: EventItem | null = await r.json().catch(() => null);
        if (updated && typeof updated.id === "number") {
          setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
          setRowEdits((prev) => ({ ...prev, [id]: makeEdit(updated) }));
        }
      }
    } catch {
      setRowErrors((prev) => ({ ...prev, [id]: t("settings_networkError") }));
    } finally {
      setRowSaving((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function deleteRow(id: number) {
    if (!window.confirm(t("events_deleteBody"))) return;
    setRowDeleting((prev) => ({ ...prev, [id]: true }));
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const r = await authedFetch(`/api/events/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        setRowErrors((prev) => ({ ...prev, [id]: b?.detail ?? t("events_deleteFailed") }));
      } else {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      setRowErrors((prev) => ({ ...prev, [id]: t("settings_networkError") }));
    } finally {
      setRowDeleting((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2>{t("events_manageTitle")}</h2>
        {children.length > 1 && (
          <select value={childId ?? ""} onChange={(e) => setChildId(Number(e.target.value))}>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setDateFrom(fd.get("date_from") as string);
          setDateTo(fd.get("date_to") as string);
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "8px 0" }}
      >
        <label>
          {t("chart_from")} <input name="date_from" type="date" defaultValue={dateFrom} required />
        </label>
        <label>
          {t("chart_to")} <input name="date_to" type="date" defaultValue={dateTo} required />
        </label>
        <button type="submit">{t("chart_load")}</button>
      </form>

      {loading && <p>{t("settings_loading")}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && events.length === 0 && <p>{t("events_noEvents")}</p>}

      {events.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t("events_colType")}</th>
                <th style={th}>{t("events_colTime")}</th>
                <th style={th}>{t("addEvent_volume")}</th>
                <th style={th}>{t("addEvent_description")}</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const edit = rowEdits[ev.id];
                if (!edit) return null;
                const et = typeById.get(ev.event_type_id);
                const showVolume = et ? et.volume_input : ev.volume != null;
                const showDesc = et ? et.describe_input : ev.description != null;
                return (
                  <tr key={ev.id}>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: et?.color ?? "var(--muted3)",
                            flexShrink: 0,
                          }}
                        />
                        {et ? t(`et_${et.name}`, et.name) : `#${ev.event_type_id}`}
                      </span>
                    </td>
                    <td style={td}>
                      <input
                        type="datetime-local"
                        value={edit.occurred_at}
                        onChange={(e) => updateRow(ev.id, "occurred_at", e.target.value)}
                      />
                    </td>
                    <td style={td}>
                      {showVolume ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={edit.volume}
                          onChange={(e) => updateRow(ev.id, "volume", e.target.value)}
                          style={{ width: 70 }}
                        />
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      {showDesc ? (
                        <input
                          type="text"
                          value={edit.description}
                          onChange={(e) => updateRow(ev.id, "description", e.target.value)}
                          style={{ width: "100%", minWidth: 120 }}
                        />
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => saveRow(ev.id)} disabled={rowSaving[ev.id]}>
                        {rowSaving[ev.id] ? t("settings_saving") : t("settings_save")}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => deleteRow(ev.id)}
                        disabled={rowDeleting[ev.id]}
                        style={{ color: "red" }}
                      >
                        {t("events_delete")}
                      </button>
                      {rowErrors[ev.id] && (
                        <div style={{ color: "red", fontSize: 11 }}>{rowErrors[ev.id]}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
