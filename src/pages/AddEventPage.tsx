import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Picker from "react-mobile-picker";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { authedFetch } from "../api/client";
import useChildren from "../hooks/useChildren";
import { useEventTypesStore } from "../store/eventTypes";
import useStatus from "../hooks/useStatus";

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
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get("type");
  const focusParam = searchParams.get("focus");
  const children = useChildren();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(() => (typeParam ? Number(typeParam) : null));
  const volumeRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);
  const [dayOptions] = useState<DayOption[]>(() => buildDayOptions(monthShort));
  const [pickerValue, setPickerValue] = useState<{ day: string; hour: string; minute: string }>(() => nowPickerValue(monthShort));
  const [description, setDescription] = useState("");
  const [volume, setVolume] = useState("");
  const [rangeLength, setRangeLength] = useState("");
  const [rangeMode, setRangeMode] = useState<"open" | "duration">("open");
  const [editingType, setEditingType] = useState(false);

  const firstChildId = children[0]?.id;
  const status = useStatus(firstChildId);
  const eventTypes = useEventTypesStore((s) => s.eventTypes);
  const loadEventTypes = useEventTypesStore((s) => s.load);

  useEffect(() => {
    if (!token || !firstChildId) return;
    loadEventTypes(firstChildId);
  }, [token, firstChildId, loadEventTypes]);

  const selectedType = eventTypes.find((et) => et.id === selectedTypeId);
  const typeById = new Map(eventTypes.map((et) => [et.id, et]));
  const suggestedVolumes =
    status?.actions.find((qa) => qa.event_type_id === selectedTypeId)?.volumes ?? [];
  const rangeTimes = ((): string | null => {
    if (selectedType?.format !== "range" || rangeMode !== "duration" || !rangeLength) return null;
    const n = Number(rangeLength);
    if (!n || n <= 0) return null;
    const dayEntry = dayOptions.find((d) => d.label === pickerValue.day);
    if (!dayEntry) return null;
    const end = new Date(`${dayEntry.date}T${pickerValue.hour.padStart(2, "0")}:${pickerValue.minute}:00`);
    const start = new Date(end.getTime() - n * 60000);
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${fmt(start)}–${fmt(end)}`;
  })();

  useEffect(() => {
    if (focusedRef.current || !focusParam || !selectedType) return;
    if (focusParam === "volume" && selectedType.volume_input && volumeRef.current) {
      volumeRef.current.focus();
      focusedRef.current = true;
    } else if (focusParam === "description" && selectedType.describe_input && descriptionRef.current) {
      descriptionRef.current.focus();
      focusedRef.current = true;
    }
  }, [focusParam, selectedType]);

  // Focus the duration field when switching to duration mode. useLayoutEffect
  // keeps focus() within the click gesture so iOS Safari also opens the keyboard.
  useLayoutEffect(() => {
    if (rangeMode === "duration") rangeRef.current?.focus();
  }, [rangeMode]);

  async function handleAddEvent() {
    if (!selectedTypeId) return;
    const dayEntry = dayOptions.find((d) => d.label === pickerValue.day);
    if (!dayEntry) return;
    const isoLocal = `${dayEntry.date}T${pickerValue.hour.padStart(2, "0")}:${pickerValue.minute}:00`;
    const occurredAt = new Date(isoLocal).toISOString();
    const useRangeRoute = selectedType?.format === "range" && rangeMode === "duration" && !!rangeLength;
    const url = useRangeRoute ? "/api/v2/events/range" : "/api/events/";
    const body =
      useRangeRoute
        ? {
            child_id: firstChildId,
            event_type_id: selectedTypeId,
            occurred_at: occurredAt,
            range_length: Number(rangeLength),
          }
        : {
            child_id: firstChildId,
            event_type_id: selectedTypeId,
            occurred_at: occurredAt,
            description: selectedType?.describe_input ? description || null : null,
            volume: selectedType?.volume_input && volume ? Number(volume) : null,
          };
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await authedFetch(url, {
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
      {selectedType && !editingType ? (
        <div className="type-picker">
          <span className="type-chip selected readonly">
            <span className="type-chip-dot" style={{ background: selectedType.color ?? "var(--muted3)" }} />
            {t(`et.${selectedType.name}`, selectedType.name)}
          </span>
          <button type="button" className="type-edit" onClick={() => setEditingType(true)}>
            {t("addEvent.changeType")}
          </button>
        </div>
      ) : (
        <div className="type-picker">
          {(status?.actions ?? []).map((a) => {
            const et = typeById.get(a.event_type_id);
            if (!et) return null;
            const selected = selectedTypeId === et.id;
            return (
              <button
                key={a.event_type_id}
                type="button"
                className={selected ? "type-chip selected" : "type-chip"}
                aria-pressed={selected}
                onClick={() => {
                  setSelectedTypeId(et.id);
                  setEditingType(false);
                  setRangeMode("open");
                  setRangeLength("");
                }}
              >
                <span className="type-chip-dot" style={{ background: et.color ?? "var(--muted3)" }} />
                {t(`et.${et.name}`, et.name)}
              </button>
            );
          })}
        </div>
      )}

      <div className="picker-container">
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
      </div>

      {selectedType?.format === "range" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="seg">
            <button
              type="button"
              className={rangeMode === "open" ? "seg-btn active" : "seg-btn"}
              onClick={() => setRangeMode("open")}
            >
              {t("addEvent.rangeModeOpen")}
            </button>
            <button
              type="button"
              className={rangeMode === "duration" ? "seg-btn active" : "seg-btn"}
              onClick={() => setRangeMode("duration")}
            >
              {t("addEvent.rangeModeDuration")}
            </button>
          </div>
          {rangeMode === "duration" && (
            <input
              ref={rangeRef}
              type="number"
              inputMode="numeric"
              min={1}
              aria-label={t("addEvent.rangeModeDuration")}
              value={rangeLength}
              onChange={(e) => setRangeLength(e.target.value)}
              style={{ width: 56 }}
            />
          )}
          {rangeMode === "duration" && rangeTimes && (
            <span style={{ fontSize: 14, color: "var(--muted2)" }}>
              {t("addEvent.willCreate")}: {t(`et.${selectedType.name}`, selectedType.name)} {rangeTimes}
            </span>
          )}
        </div>
      )}

      {selectedType?.volume_input && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            {t("addEvent.volume")}
            {suggestedVolumes.map((v) => (
              <button key={v} type="button" className="volume-hint" onClick={() => setVolume(String(v))}>
                {v}
              </button>
            ))}
          </span>
          <input
            ref={volumeRef}
            type="number"
            inputMode="decimal"
            min={0}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            placeholder={t("addEvent.optional")}
          />
        </label>
      )}

      {selectedType?.describe_input && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {t("addEvent.description")}
          <input
            ref={descriptionRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("addEvent.optional")}
          />
        </label>
      )}

      {submitError && <div style={{ color: "red" }}>{submitError}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={
            !selectedTypeId ||
            submitting ||
            (selectedType?.format === "range" && rangeMode === "duration" && !rangeTimes)
          }
          onClick={handleAddEvent}
        >
          {submitting
            ? t("addEvent.saving")
            : rangeTimes
              ? `${t("addEvent.save")} · ${rangeTimes}`
              : t("addEvent.save")}
        </button>
      </div>
    </div>
  );
}
