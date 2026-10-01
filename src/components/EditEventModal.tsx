import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { authedFetch } from "../api/client";
import useStatus from "../hooks/useStatus";
import type { EventType } from "../store/eventTypes";
import type { EventItem } from "../pages/EventsPage";

// "2026-09-01T14:30:00" (or with a space separator) -> "2026-09-01T14:30" for the input.
function toInputValue(occurredAt: string): string {
  return occurredAt.replace(" ", "T").slice(0, 16);
}

// Local wall-clock from <input type="datetime-local"> -> UTC ISO ("...Z").
// PATCH /api/events/{id} is intentionally sent in UTC (mirrors AddEventPage),
// unlike the naive-local time the GET returns.
function toUtcIso(inputValue: string): string {
  const localIso = inputValue.length === 16 ? `${inputValue}:00` : inputValue;
  return new Date(localIso).toISOString();
}

interface Props {
  event: EventItem;
  eventType: EventType | undefined;
  childId: number;
  onClose: () => void;
  onSaved: (updated: EventItem) => void;
}

export default function EditEventModal({ event, eventType, childId, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { status } = useStatus(childId);

  const [occurredAt, setOccurredAt] = useState(() => toInputValue(event.occurred_at));
  const [volume, setVolume] = useState(event.volume == null ? "" : String(event.volume));
  const [description, setDescription] = useState(event.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Close on Escape + lock body scroll while open (mirrors the nav drawer in Layout).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const showVolume = eventType ? eventType.volume_input : event.volume != null;
  const showDesc = eventType ? eventType.describe_input : event.description != null;
  const suggestedVolumes =
    status?.actions.find((qa) => qa.event_type_id === event.event_type_id)?.volumes ?? [];

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body = {
        occurred_at: toUtcIso(occurredAt),
        volume: volume.trim() === "" ? null : Number(volume),
        description: description.trim() === "" ? null : description,
      };
      const r = await authedFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        setError(b?.detail ?? t("events_saveFailed"));
        return;
      }
      const updated: EventItem | null = await r.json().catch(() => null);
      if (updated && typeof updated.id === "number") {
        onSaved(updated);
      } else {
        onClose();
      }
    } catch {
      setError(t("settings_networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{t("events_editTitle")}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">
          <div className="type-picker">
            <span className="type-chip selected readonly">
              <span className="type-chip-dot" style={{ background: eventType?.color ?? "var(--muted3)" }} />
              {eventType ? t(`et_${eventType.name}`, eventType.name) : `#${event.event_type_id}`}
            </span>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {t("events_colTime")}
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </label>

          {showVolume && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                {t("addEvent_volume")}
                {suggestedVolumes.map((v) => (
                  <button key={v} type="button" className="volume-hint" onClick={() => setVolume(String(v))}>
                    {v}
                  </button>
                ))}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder={t("addEvent_optional")}
              />
            </label>
          )}

          {showDesc && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {t("addEvent_description")}
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("addEvent_optional")}
              />
            </label>
          )}

          {error && <div style={{ color: "red" }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? t("addEvent_saving") : t("settings_save")}
          </button>
        </div>
      </div>
    </div>
  );
}
