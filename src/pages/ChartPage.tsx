import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useChildren from "../hooks/useChildren";
import { useAuthStore } from "../store/auth";
import { useEventTypesStore } from "../store/eventTypes";
import { authedFetch } from "../api/client";
import useStatus from "../hooks/useStatus";

// iOS Safari only opens the software keyboard from within a user gesture.
// The quick-add links navigate to /add-event, where the target field is
// focused inside an effect (outside any gesture), so on iOS the field focuses
// but the keyboard stays down. Focusing a throwaway off-screen input during
// the tap opens the keyboard; when AddEventPage then focuses the real field,
// iOS keeps it up (focus moving input→input). The primer lives on document.body
// so it survives the client-side navigation, and removes itself once the real
// field steals focus.
//
// The primer's inputMode must match the target field: once the keyboard is
// open, iOS keeps its original layout across an input→input focus move, so a
// text primer would leave a text keyboard on the numeric volume field.
function primeIosKeyboard(inputMode: "text" | "decimal") {
  const primer = document.createElement("input");
  primer.setAttribute("aria-hidden", "true");
  primer.tabIndex = -1;
  primer.inputMode = inputMode;
  primer.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;";
  primer.addEventListener("blur", () => primer.remove(), { once: true });
  document.body.appendChild(primer);
  primer.focus();
}

// --- Chart types ---

interface ChartRow {
  day: string;
  start: string;
  end: string;
}


interface AdditionalEvent {
  id: number;
  event_type_id: number;
  occurred_at: string;
  description: string | null;
}

interface ChartResponse {
  sleep_data: ChartRow[];
  additional_data?: Record<string, AdditionalEvent[]>;
}

// --- Dashboard types ---

interface Segment {
  start: string;
  end: string;
  minutes: number;
  state: "sleep" | "awake";
  day_part: "day" | "night";
  nap_number: number | null;
  is_current: boolean;
}

interface PredictionSegment {
  start_dt: string;
  end_dt: string;
  time: number;
  segment_type: "night_sleep" | "day_sleep" | "day_awake";
}

interface DayData {
  segments: Segment[];
  bedtime: string | null;
  morning_awake_time: string | null;
  total_sleep_minutes: number;
  day_sleep_minutes: number;
  night_sleep_minutes: number;
  total_awake_minutes: number;
  day_awake_minutes: number;
  night_awake_minutes: number;
  current_sleep_minutes: number;
  current_awake_minutes: number;
  is_currently_asleep: boolean;
  cycle_length_minutes: number;
}

interface DashboardData {
  today: DayData;
  yesterday: DayData;
  day_before_yesterday: DayData;
}

// --- Helpers ---

function timeToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: false });
}

function getTodayInTz(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

function getCurrentMinutesInTz(timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute;
}

function utcDtToLocalDate(utcDt: string, timezone: string): string {
  const d = new Date(utcDt.replace(" ", "T") + "Z");
  return d.toLocaleDateString("en-CA", { timeZone: timezone });
}

function utcDtToLocalMinutes(utcDt: string, timezone: string): number {
  const d = new Date(utcDt.replace(" ", "T") + "Z");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute;
}

function utcDtToLocalTimeStr(utcDt: string, timezone: string): string {
  const d = new Date(utcDt.replace(" ", "T") + "Z");
  return d.toLocaleTimeString([], { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDuration(minutes: number | undefined | null): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}



function minutesAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function colorForEventType(color: string | null): string {
  return color ? `#${color}` : "#000";
}

function formatDayLabel(dateStr: string, months: string[]): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${day} ${months[month - 1]}`;
}

function minutesToTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

// --- CurrentStatus component (running current sleep / awake + prediction) ---

function CurrentStatus({ data, predictions, timezone }: {
  data: { is_currently_asleep: boolean; current_sleep_minutes: number; current_awake_minutes: number };
  predictions?: PredictionSegment[]; timezone?: string | null;
}) {
  const { t } = useTranslation();
  const nowMs = Date.now();

  const sleepPred = (predictions && timezone && data.is_currently_asleep)
    ? predictions.find(p =>
        (p.segment_type === "day_sleep" || p.segment_type === "night_sleep") &&
        new Date(p.start_dt.replace(" ", "T") + "Z").getTime() <= nowMs &&
        new Date(p.end_dt.replace(" ", "T") + "Z").getTime() > nowMs
      ) ?? null
    : null;

  const awakePred = (predictions && timezone && !data.is_currently_asleep)
    ? predictions.find(p =>
        p.segment_type === "day_awake" &&
        new Date(p.start_dt.replace(" ", "T") + "Z").getTime() <= nowMs &&
        new Date(p.end_dt.replace(" ", "T") + "Z").getTime() > nowMs
      ) ?? null
    : null;

  const sleepMinsLeft = sleepPred
    ? Math.round((new Date(sleepPred.end_dt.replace(" ", "T") + "Z").getTime() - nowMs) / 60_000)
    : null;
  const awakeMinsLeft = awakePred
    ? Math.round((new Date(awakePred.end_dt.replace(" ", "T") + "Z").getTime() - nowMs) / 60_000)
    : null;

  if (data.current_sleep_minutes <= 0 && data.current_awake_minutes <= 0) return null;

  return (
    <>
      {data.is_currently_asleep && data.current_sleep_minutes > 0 && (
        <div style={{ background: "var(--surface2)", borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          {t("chart.currentSleep")} {formatDuration(data.current_sleep_minutes)}
          {sleepPred && sleepMinsLeft !== null && sleepMinsLeft > 0 && timezone && (
            <span style={{ color: "var(--muted)", fontSize: "0.9em" }}>
              (~{utcDtToLocalTimeStr(sleepPred.end_dt, timezone)}, {t("chart.in")} {formatDuration(sleepMinsLeft)})
            </span>
          )}
        </div>
      )}
      {!data.is_currently_asleep && data.current_awake_minutes > 0 && (
        <div style={{ background: "var(--surface2)", borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          {t("chart.currentAwake")} {formatDuration(data.current_awake_minutes)}
          {awakePred && awakeMinsLeft !== null && awakeMinsLeft > 0 && timezone && (
            <span style={{ color: "var(--muted)", fontSize: "0.9em" }}>
              (~{utcDtToLocalTimeStr(awakePred.end_dt, timezone)}, {t("chart.in")} {formatDuration(awakeMinsLeft)})
            </span>
          )}
        </div>
      )}
    </>
  );
}

// --- DayColumn component ---

function DayColumn({ title, data, live = false, fetchedAtMs = 0 }: {
  title: string; data: DayData; live?: boolean; fetchedAtMs?: number;
}) {
  const { t } = useTranslation();
  const wakeUpSource = data.morning_awake_time;
  const wakeUpFormatted = wakeUpSource ? formatTime(wakeUpSource) : null;
  const currentSeg = live ? data.segments.find((s) => s.is_current) ?? null : null;

  // Live minute counting between the once-a-minute refetches (which fire only on
  // sleep/wake flips). The parent's minute heartbeat re-renders us, so `grown`
  // recomputes each minute; a refetch re-anchors fetchedAtMs and the backend baseline.
  const grown = live ? Math.max(0, Math.floor((Date.now() - fetchedAtMs) / 60000)) : 0;
  const totalSleep = data.total_sleep_minutes + (currentSeg?.state === "sleep" ? grown : 0);
  const nightSleep = data.night_sleep_minutes + (currentSeg?.state === "sleep" && currentSeg.day_part === "night" ? grown : 0);
  const daySleep = data.day_sleep_minutes + (currentSeg?.state === "sleep" && currentSeg.day_part === "day" ? grown : 0);
  const totalAwake = data.total_awake_minutes + (currentSeg?.state === "awake" ? grown : 0);
  const cycle = data.cycle_length_minutes + grown;

  const hasData =
    data.segments.length > 0 ||
    data.total_sleep_minutes > 0 ||
    data.total_awake_minutes > 0 ||
    data.bedtime != null ||
    data.morning_awake_time != null;

  if (!hasData) {
    return (
      <div>
        <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>
        <div style={{ color: "var(--muted)" }}>{t("chart.noData")}</div>
      </div>
    );
  }

  return (
    <div>
      <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>

      {data.bedtime && (
        <div style={{ marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          {t("chart.bedtime")} {formatTime(data.bedtime)}
        </div>
      )}

      {currentSeg && (currentSeg.state === "sleep" ? !data.bedtime : formatTime(currentSeg.start) !== wakeUpFormatted) && (
        currentSeg.state === "sleep" ? (
          <div style={{ marginTop: "5px", marginBottom: "5px", maxWidth: "220px", background: "var(--surface2)" }}>
            {t("chart.fellAsleep")} {formatTime(currentSeg.start)}
          </div>
        ) : (
          <div style={{ marginTop: 5, marginBottom: 5 }}>
            {t("chart.wokeUp")} {formatTime(currentSeg.start)}
          </div>
        )
      )}

      {data.segments.map((seg, i) => {
        if (seg.state === "awake" && !seg.is_current) {
          return <div key={i}>{t("chart.awake")} {formatDuration(seg.minutes)}</div>;
        }
        if (seg.state === "sleep" && seg.day_part === "day" && !seg.is_current) {
          return (
            <div key={i} style={{ marginTop: "5px", marginBottom: "5px", maxWidth: "220px", background: "var(--surface2)" }}>
              &nbsp;#{seg.nap_number} &nbsp; {formatTime(seg.start)}–{formatTime(seg.end)} &nbsp; {formatDuration(seg.minutes)}
            </div>
          );
        }
        return null;
      })}

      {wakeUpFormatted != null && (
        <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          {t("chart.wakeUp")} {wakeUpFormatted}
        </div>
      )}

      <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
        <div>{t("chart.totalSleep")} {formatDuration(totalSleep)}</div>
        <div>{t("chart.nightSleep")} {formatDuration(nightSleep)}</div>
        <div>{t("chart.daySleep")} {formatDuration(daySleep)}</div>
        <div>{t("chart.awake")} {formatDuration(totalAwake)}</div>
        {data.cycle_length_minutes != null && (
          <div>{t("chart.cycle")} {formatDuration(cycle)}</div>
        )}
      </div>
    </div>
  );
}

const MINUTES_IN_DAY = 24 * 60;

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getLast15Days(anchor?: string): { dateFrom: string; dateTo: string } {
  const today = anchor ? new Date(anchor) : new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 14);
  return { dateFrom: toDateString(from), dateTo: toDateString(today) };
}

const SLEEP_EVENT_NAMES = ["sleep_start", "sleep_end"];

export default function ChartPage() {
  const { t } = useTranslation();
  const monthNames = t("common.months").split("_");
  const [searchParams] = useSearchParams();
  const todayParam = searchParams.get("today") ?? undefined;
  const predictEnabled = searchParams.get("predict") !== "0";

  const children = useChildren();
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [predictions, setPredictions] = useState<PredictionSegment[]>([]);
  const [error, setError] = useState("");
  const eventTypes = useEventTypesStore((s) => s.eventTypes);
  const loadEventTypes = useEventTypesStore((s) => s.load);
  const sleepEventTypeIds = useMemo(
    () =>
      SLEEP_EVENT_NAMES.map((name) => eventTypes.find((et) => et.name === name)?.id).filter(
        (id): id is number => id !== undefined,
      ),
    [eventTypes],
  );
  const [selectedAdditionalIds, setSelectedAdditionalIds] = useState<number[]>([]);
  const [additionalData, setAdditionalData] = useState<Record<string, AdditionalEvent[]>>({});
  const chartRef = useRef<HTMLDivElement>(null);
  const firstBarRef = useRef<HTMLDivElement | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const dashboardFetchedAt = useRef<number>(0);
  const { dateFrom, dateTo } = getLast15Days(todayParam);

  const firstChildId = children[0]?.id;
  const timezone = children[0]?.timezone;
  const todayInTz = timezone ? getTodayInTz(timezone) : null;
  const currentMinutes = timezone ? getCurrentMinutesInTz(timezone) : null;
  const status = useStatus(firstChildId);

  // Local once-a-minute heartbeat: forces a re-render so the render-time "now"
  // values (currentMinutes / todayInTz / minutesAgo) advance — the "now" line,
  // the "X ago" labels and the growing current-sleep bar. Costs no network.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (todayParam) return; // historical view has no live "now"
    const id = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(id);
  }, [todayParam]);

  // Heavy data loads on mount / real dependency changes, and in the steady state
  // is only re-fetched when the sleep status flips (see the effect after
  // loadChart). The single minute poller is useStatus's /api/v2/status.
  function fetchDashboard() {
    if (!firstChildId) return;
    const url = new URL("/api/chart/dashboard", window.location.origin);
    url.searchParams.set("child_id", String(firstChildId));
    if (todayParam) url.searchParams.set("today", todayParam);
    authedFetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        if (data?.today) {
          setDashboard(data as DashboardData);
          dashboardFetchedAt.current = Date.now();
        }
      })
      .catch(() => {});
  }

  function fetchPredictions() {
    if (!firstChildId || !predictEnabled) return;
    const url = new URL("/api/chart/sleep-predict", window.location.origin);
    url.searchParams.set("child_id", String(firstChildId));
    authedFetch(url.toString())
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data?.predictions)) setPredictions(data.predictions); })
      .catch(() => {});
  }

  useEffect(() => {
    fetchDashboard();
  }, [firstChildId, token, todayParam]);

  useEffect(() => {
    fetchPredictions();
  }, [firstChildId, token, predictEnabled]);

  useEffect(() => {
    if (!token || !firstChildId) return;
    loadEventTypes(firstChildId);
  }, [token, firstChildId, loadEventTypes]);

  async function loadChart(childId: number, from: string, to: string, additionalIds: number[] = []) {
    setError("");
    const url = new URL("/api/chart/", window.location.origin);
    url.searchParams.set("child_id", String(childId));
    url.searchParams.set("date_from", from);
    url.searchParams.set("date_to", to);
    sleepEventTypeIds.forEach((id) => url.searchParams.append("event_type_ids", String(id)));
    additionalIds.forEach((id) => url.searchParams.append("additional_data_ids", String(id)));
    try {
      const r = await authedFetch(url.toString());
      if (!r.ok) { setError(t("chart.loadFailed")); return; }
      const data: ChartResponse = await r.json();
      setRows(data.sleep_data ?? []);
      setAdditionalData(data.additional_data ?? {});
    } catch {
      setError(t("chart.loadFailed"));
    }
  }

  useEffect(() => {
    if (!firstChildId || sleepEventTypeIds.length === 0) return;
    loadChart(firstChildId, dateFrom, dateTo, selectedAdditionalIds);
  }, [firstChildId, todayParam, selectedAdditionalIds, sleepEventTypeIds]);

  // Steady-state trigger: when useStatus reports a sleep-status flip, refresh the
  // heavy data once. Completed segments, dashboard totals and predictions change
  // exactly at sleep start/end, so this is the only refetch they need per day.
  const prevAsleep = useRef<boolean | null>(null);
  useEffect(() => {
    const cur = status?.is_currently_asleep;
    if (cur == null || !firstChildId) return;
    if (prevAsleep.current !== null && prevAsleep.current !== cur) {
      fetchDashboard();
      fetchPredictions();
      if (sleepEventTypeIds.length > 0) {
        loadChart(firstChildId, dateFrom, dateTo, selectedAdditionalIds);
      }
    }
    prevAsleep.current = cur;
  }, [status?.is_currently_asleep]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    loadChart(
      Number(fd.get("child_id")),
      fd.get("date_from") as string,
      fd.get("date_to") as string,
      selectedAdditionalIds,
    );
  }

  // Group rows by day
  const byDay = new Map<string, ChartRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.day);
    if (list) list.push(row);
    else byDay.set(row.day, [row]);
  }

  const typeById = new Map(eventTypes.map((et) => [et.id, et]));
  const visibleLastEvents = (status?.last_events ?? []).filter(
    (ev) => typeById.get(ev.event_type_id)?.show_in_last_events !== false,
  );
  const quickActions = (status?.actions ?? []).filter((a) => a.show_in_quick_actions);
  const showQuickAdd = !todayParam;

  return (
    <div>
      {(visibleLastEvents.length > 0 || (dashboard && !todayParam) || showQuickAdd) && (
        <div className="status-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
          <div className="last-events" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            {status && !todayParam && (
              <CurrentStatus data={status} predictions={predictEnabled ? predictions : undefined} timezone={timezone} />
            )}
            {visibleLastEvents.map((ev, i) => (
              <div key={i} style={{ background: "var(--surface)", borderRadius: 6, padding: "4px 10px", font: "inherit", display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontWeight: 500 }}>{t(`et.${ev.name}`, ev.name)}</span>
                <span style={{ color: "var(--muted)" }}>{formatDuration(minutesAgo(ev.occurred_at))} ago</span>
                {ev.volume != null && <span style={{ color: "var(--muted2)" }}>{ev.volume} ml</span>}
                {ev.description && <span style={{ color: "var(--muted2)" }}>{ev.description}</span>}
              </div>
            ))}
            {visibleLastEvents.length === 0 && (
              <div style={{ background: "var(--surface)", borderRadius: 6, padding: "4px 10px", font: "inherit", color: "var(--muted)" }}>
                {t("chart.noData")}
              </div>
            )}
          </div>
          {showQuickAdd && (
            <div className="quick-add">
              {quickActions.map((qa) => {
                const et = typeById.get(qa.event_type_id);
                if (!et) return null;
                const focusQuery = qa.focus ? `&focus=${qa.focus}` : "";
                const prime =
                  qa.focus === "volume"
                    ? () => primeIosKeyboard("decimal")
                    : qa.focus === "description"
                    ? () => primeIosKeyboard("text")
                    : undefined;
                return (
                  <Link key={qa.event_type_id} className={`qa-btn qa-${et.name}`} to={`/add-event?type=${et.id}${focusQuery}`} onClick={prime}>
                    {t(`et.${et.name}`, et.name)}
                  </Link>
                );
              })}
              <Link className="qa-btn qa-add-event" to="/add-event">
                {t("nav.addEvent")}
              </Link>
            </div>
          )}
        </div>
      )}

      {dashboard && (
        <div className="dashboard-columns">
          <div className="dashboard-col"><DayColumn title={t("chart.today")} data={dashboard.today} live={!todayParam} fetchedAtMs={dashboardFetchedAt.current} /></div>
          <div className="dashboard-col"><DayColumn title={t("chart.yesterday")} data={dashboard.yesterday} /></div>
          <div className="dashboard-col"><DayColumn title={t("chart.dayBefore")} data={dashboard.day_before_yesterday} /></div>
        </div>
      )}

      {byDay.size > 0 && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "none" }}>
          {t("chart.child")}{" "}
          <select name="child_id" required>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          {t("chart.dateFrom")} <input name="date_from" type="date" defaultValue={dateFrom} required />
        </label>
        <label>
          {t("chart.dateTo")} <input name="date_to" type="date" defaultValue={dateTo} required />
        </label>
        <button type="submit">{t("chart.load")}</button>
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {eventTypes
          .filter((et) => et.show_in_filters)
          .map((et) => (
            <label key={et.id} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selectedAdditionalIds.includes(et.id)}
                onChange={(e) => {
                  setSelectedAdditionalIds((prev) =>
                    e.target.checked ? [...prev, et.id] : prev.filter((id) => id !== et.id)
                  );
                }}
              />
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colorForEventType(et.color) }} />
              {et.name}
            </label>
          ))}
      </div>
      </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {byDay.size > 0 && (
        <div
          ref={chartRef}
          style={{ marginTop: 16, position: "relative" }}
          onMouseMove={(e) => {
            const rect = chartRef.current!.getBoundingClientRect();
            setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setHoverPos(null)}
        >
          <div style={{ display: "flex", marginBottom: 4 }}>
            <div style={{ flex: 1, position: "relative", height: 12, fontSize: 9, color: "var(--muted3)" }}>
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${(i / 24) * 100}%`,
                    transform: i === 0 ? "none" : "translateX(-50%)",
                  }}
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
          {[...byDay.entries()].reverse().map(([day, segments], index) => (
            <div key={day} className="chart-day-row" style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <div
                ref={(el) => { if (index === 0 && el) firstBarRef.current = el; }}
                style={{
                  flex: 1,
                  height: 20,
                  background: "var(--surface2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <span className="chart-day-date">{formatDayLabel(day, monthNames)}</span>
                {day === todayInTz && currentMinutes !== null && (() => {
                  const lineLeft = (currentMinutes / MINUTES_IN_DAY) * 100;
                  return (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: `${lineLeft}%`,
                          width: 2,
                          height: "100%",
                          background: "var(--text)",
                          pointerEvents: "none",
                          zIndex: 1,
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          left: `calc(${lineLeft}% + 4px)`,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 8,
                          lineHeight: 1,
                          color: "var(--text)",
                          zIndex: 2,
                          pointerEvents: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {minutesToTimeLabel(currentMinutes)}
                      </span>
                    </>
                  );
                })()}
                {segments.map((seg, i) => {
                  const startMin = timeToMinutes(seg.start);
                  const endMinRaw = timeToMinutes(seg.end);
                  let duration = endMinRaw - startMin;
                  let endMin = endMinRaw === 0 ? MINUTES_IN_DAY : endMinRaw;
                  let current = false;
                  if (day === todayInTz && currentMinutes !== null && endMin > currentMinutes) {
                    endMin = currentMinutes;
                    duration = currentMinutes - startMin;
                    current = true;
                  }
                  const left = (startMin / MINUTES_IN_DAY) * 100;
                  const width = ((endMin - startMin) / MINUTES_IN_DAY) * 100;
                  const titleText = current
                      ? `${formatDuration(duration)} | ${formatTime(seg.start)} – `
                      : `${formatDuration(duration)} | ${formatTime(seg.start)} – ${formatTime(seg.end)}`;
                  return (
                    <div
                      key={i}
                      title={titleText}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        width: `${width}%`,
                        height: "100%",
                        background: "#4a90d9",
                      }}
                    />
                  );
                })}
                {predictEnabled && day === todayInTz && timezone && predictions
                  .filter((p) => p.segment_type !== "day_awake")
                  .filter((p) => {
                    const sd = utcDtToLocalDate(p.start_dt, timezone);
                    const ed = utcDtToLocalDate(p.end_dt, timezone);
                    return sd <= todayInTz! && ed >= todayInTz!;
                  })
                  .map((p, i) => {
                    const sd = utcDtToLocalDate(p.start_dt, timezone);
                    const ed = utcDtToLocalDate(p.end_dt, timezone);
                    const startMin = sd === todayInTz ? utcDtToLocalMinutes(p.start_dt, timezone) : 0;
                    const endMin = ed === todayInTz ? utcDtToLocalMinutes(p.end_dt, timezone) : MINUTES_IN_DAY;
                    const duration = endMin - startMin;
                    const left = (startMin / MINUTES_IN_DAY) * 100;
                    const width = ((endMin - startMin) / MINUTES_IN_DAY) * 100;
                    return (
                      <div
                        key={`pred-${i}`}
                        title={`${minutesToTimeLabel(startMin)} – ${minutesToTimeLabel(endMin)} | ${formatDuration(duration)}`}
                        style={{
                          position: "absolute",
                          left: `${left}%`,
                          width: `${width}%`,
                          height: "100%",
                          background: "rgba(74, 144, 217, 0.33)",
                        }}
                      />
                    );
                  })
                }
                {predictEnabled && day === todayInTz && timezone && currentMinutes !== null && status?.is_currently_asleep && (() => {
                  const overlapPred = predictions.find((p) => {
                    if (p.segment_type !== "day_awake") return false;
                    const sd = utcDtToLocalDate(p.start_dt, timezone!);
                    const ed = utcDtToLocalDate(p.end_dt, timezone!);
                    const startMin = sd === todayInTz ? utcDtToLocalMinutes(p.start_dt, timezone!) : 0;
                    const endMin = ed === todayInTz ? utcDtToLocalMinutes(p.end_dt, timezone!) : MINUTES_IN_DAY;
                    return startMin <= currentMinutes! && endMin > currentMinutes!;
                  });
                  if (!overlapPred) return null;
                  const ed = utcDtToLocalDate(overlapPred.end_dt, timezone!);
                  const endMin = ed === todayInTz ? utcDtToLocalMinutes(overlapPred.end_dt, timezone!) : MINUTES_IN_DAY;
                  const width = ((endMin - currentMinutes!) / MINUTES_IN_DAY) * 100;
                  if (width <= 0) return null;
                  return (
                    <div
                      key="pred-current-sleep-ext"
                      title={`${minutesToTimeLabel(currentMinutes!)} – ${minutesToTimeLabel(endMin)}`}
                      style={{
                        position: "absolute",
                        left: `${(currentMinutes! / MINUTES_IN_DAY) * 100}%`,
                        width: `${width}%`,
                        height: "100%",
                        background: "rgba(74, 144, 217, 0.33)",
                      }}
                    />
                  );
                })()}
                {Object.entries(additionalData).flatMap(([typeIdStr, events]) => {
                  const typeId = Number(typeIdStr);
                  const etColor = eventTypes.find((et) => et.id === typeId)?.color ?? null;
                  const color = colorForEventType(etColor);
                  return events
                    .filter((ev) => ev.occurred_at.startsWith(day))
                    .map((ev) => {
                      const minutes = timeToMinutes(ev.occurred_at);
                      const left = (minutes / MINUTES_IN_DAY) * 100;
                      return (
                        <div
                          key={ev.id}
                          title={ev.description ?? formatTime(ev.occurred_at)}
                          style={{
                            position: "absolute",
                            left: `${left}%`,
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: color,
                            zIndex: 3,
                          }}
                        />
                      );
                    });
                })}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", marginTop: 4 }}>
            <div style={{ flex: 1, position: "relative", height: 12, fontSize: 9, color: "var(--muted3)" }}>
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${(i / 24) * 100}%`,
                    transform: i === 0 ? "none" : "translateX(-50%)",
                  }}
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
          {hoverPos && firstBarRef.current && chartRef.current && (() => {
            const chartRect = chartRef.current!.getBoundingClientRect();
            const barRect = firstBarRef.current!.getBoundingClientRect();
            const barLeft = barRect.left - chartRect.left;
            const barWidth = barRect.width;
            const xInBar = hoverPos.x - barLeft;
            if (xInBar < 0 || xInBar > barWidth) return null;
            const minutes = Math.round((xInBar / barWidth) * MINUTES_IN_DAY);
            return (
              <>
                <div
                  style={{
                    position: "absolute",
                    left: hoverPos.x,
                    top: 0,
                    width: 1,
                    height: "100%",
                    background: "var(--crosshair)",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: hoverPos.x + 4,
                    top: hoverPos.y,
                    transform: "translateY(-50%)",
                    fontSize: 8,
                    lineHeight: 1,
                    color: "var(--text)",
                    zIndex: 11,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {minutesToTimeLabel(minutes)}
                </span>
              </>
            );
          })()}
        </div>
      )}

      {byDay.size === 0 && !error && (
        <div style={{ marginTop: 16, color: "var(--muted)" }}>{t("chart.noData")}</div>
      )}
    </div>
  );
}
