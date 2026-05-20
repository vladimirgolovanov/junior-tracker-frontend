import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Picker from "react-mobile-picker";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { authedFetch } from "../api/client";
import useChildren from "../hooks/useChildren";
import { useEventTypesStore } from "../store/eventTypes";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i));
const MINUTES = ["00","05","10","15","20","25","30","35","40","45","50","55"];

interface DayOption {
  label: string;
  date: string;
}

function buildDayOptions(monthShort: string[]): DayOption[] {
  const now = new Date();
  const opts: DayOption[] = [];
  for (let i = -7; i <= 1; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    opts.push({
      label: `${d.getDate()} ${monthShort[d.getMonth()]}`,
      date: [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"),
    });
  }
  return opts;
}

function nowPickerValue(monthShort: string[]): { day: string; hour: string; minute: string } {
  const now = new Date();
  const m = Math.round(now.getMinutes() / 5) * 5;
  const d = new Date(now);
  if (m === 60) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  } else {
    d.setMinutes(m);
  }
  return {
    day: `${d.getDate()} ${monthShort[d.getMonth()]}`,
    hour: String(d.getHours()),
    minute: String(d.getMinutes()).padStart(2, "0"),
  };
}

export default function AddEventPage() {
  const { t } = useTranslation();
  const monthShort = t("common.months").split("_");
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const children = useChildren();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [dayOptions] = useState<DayOption[]>(() => buildDayOptions(monthShort));
  const [pickerValue, setPickerValue] = useState<{ day: string; hour: string; minute: string }>(() => nowPickerValue(monthShort));
  const [description, setDescription] = useState("");
  const [volume, setVolume] = useState("");
  const [isCurrentAsleep, setIsCurrentAsleep] = useState<boolean | null>(null);

  const firstChildId = children[0]?.id;
  const eventTypes = useEventTypesStore((s) => s.eventTypes);
  const loadEventTypes = useEventTypesStore((s) => s.load);

  useEffect(() => {
    if (!token || !firstChildId) return;
    loadEventTypes(firstChildId);
  }, [token, firstChildId, loadEventTypes]);

  useEffect(() => {
    if (!token || !firstChildId) return;
    const url = new URL("/api/chart/dashboard", window.location.origin);
    url.searchParams.set("child_id", String(firstChildId));
    authedFetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.today?.is_current_asleep === "boolean") {
          setIsCurrentAsleep(data.today.is_current_asleep);
        }
      })
      .catch(() => {});
  }, [token, firstChildId]);

  const filteredTypes = eventTypes.filter((et) => {
    if (et.format === "range") return isCurrentAsleep !== true;
    if (et.format === "range_end") return isCurrentAsleep !== false;
    return true;
  });

  const selectedType = eventTypes.find((et) => et.id === selectedTypeId);

  async function handleAddEvent() {
    if (!selectedTypeId) return;
    const dayEntry = dayOptions.find((d) => d.label === pickerValue.day);
    if (!dayEntry) return;
    const isoLocal = `${dayEntry.date}T${pickerValue.hour.padStart(2, "0")}:${pickerValue.minute}:00`;
    const body = {
      child_id: firstChildId,
      event_type_id: selectedTypeId,
      occurred_at: new Date(isoLocal).toISOString(),
      description: selectedType?.describe_input ? description || null : null,
      volume: selectedType?.volume_input && volume ? Number(volume) : null,
    };
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await authedFetch("/api/events/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed");
      navigate(-1);
    } catch {
      setSubmitError(t("addEvent.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {filteredTypes.map((et) => (
          <label key={et.id} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="radio"
              name="event_type_id"
              value={et.id}
              checked={selectedTypeId === et.id}
              onChange={() => setSelectedTypeId(et.id)}
            />
            {et.name}
          </label>
        ))}
      </div>

      <Picker
        value={pickerValue}
        onChange={(v) => setPickerValue(v as typeof pickerValue)}
        height={180}
        itemHeight={36}
        wheelMode="natural"
      >
        <Picker.Column name="day">
          {dayOptions.map((d) => (
            <Picker.Item key={d.label} value={d.label}>{d.label}</Picker.Item>
          ))}
        </Picker.Column>
        <Picker.Column name="hour">
          {HOURS.map((h) => (
            <Picker.Item key={h} value={h}>{h}</Picker.Item>
          ))}
        </Picker.Column>
        <Picker.Column name="minute">
          {MINUTES.map((m) => (
            <Picker.Item key={m} value={m}>{m}</Picker.Item>
          ))}
        </Picker.Column>
      </Picker>

      {selectedType?.describe_input && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {t("addEvent.description")}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("addEvent.optional")}
          />
        </label>
      )}

      {selectedType?.volume_input && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {t("addEvent.volume")}
          <input
            type="number"
            min={0}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            placeholder={t("addEvent.optional")}
          />
        </label>
      )}

      {submitError && <div style={{ color: "red" }}>{submitError}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button type="button" onClick={() => navigate(-1)}>{t("addEvent.cancel")}</button>
        <button type="button" disabled={!selectedTypeId || submitting} onClick={handleAddEvent}>
          {submitting ? t("addEvent.saving") : t("addEvent.save")}
        </button>
      </div>
    </div>
  );
}
