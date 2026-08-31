import { FormEvent, useEffect, useRef, useState } from "react";
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
  end: string | null; // null → current unfinished sleep (grows to "now")
}


interface AdditionalEvent {
  id: number;
  event_type_id: number;
  occurred_at: string;
  // description / volume are omitted (not null) when absent for the event type.
  description?: string | null;
  volume?: number | null;
  // Present only for range-type events: minutes (a completed span) or null (still
  // running → chart extends it to "now" each minute). Absent → point event (dot).
  duration?: number | null;
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

// Add whole days to a "YYYY-MM-DD" string (UTC math, timezone-free).
function addDays(day: string, n: number): string {
  if (n === 0) return day;
  return new Date(Date.parse(day + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}

// Backend now sends child-local wall-clock datetimes ("YYYY-MM-DD HH:MM:SS", no
// timezone). These parse them by fixed position — no Intl, no timezone.
function localDtToDay(dt: string): string {
  return dt.slice(0, 10);
}

function localDtToMinutes(dt: string): number {
  return Number(dt.slice(11, 13)) * 60 + Number(dt.slice(14, 16));
}

// Day number since the epoch, from a "YYYY-MM-DD" string (parsed as UTC midnight,
// so it never depends on the browser timezone).
function dayIndex(day: string): number {
  return Math.round(Date.parse(day + "T00:00:00Z") / 86_400_000);
}

// Position on the child's continuous local timeline, in minutes. Lets us compare
// datetimes and "now" across midnight without any timezone math.
function localOrd(dt: string): number {
  return dayIndex(localDtToDay(dt)) * MINUTES_IN_DAY + localDtToMinutes(dt);
}

function formatDuration(minutes: number | undefined | null): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
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

function CurrentStatus({ data, predictions, nowMin, today }: {
  data: { is_currently_asleep: boolean; current_sleep_minutes: number; current_awake_minutes: number };
  predictions?: PredictionSegment[]; nowMin?: number | null; today?: string | null;
}) {
  const { t } = useTranslation();
  // "now" on the same child-local timeline as the predictions, from the status seed.
  const nowOrd = (nowMin != null && today) ? dayIndex(today) * MINUTES_IN_DAY + nowMin : null;

  const sleepPred = (predictions && nowOrd !== null && data.is_currently_asleep)
    ? predictions.find(p =>
        (p.segment_type === "day_sleep" || p.segment_type === "night_sleep") &&
        localOrd(p.start_dt) <= nowOrd &&
        localOrd(p.end_dt) > nowOrd
      ) ?? null
    : null;

  const awakePred = (predictions && nowOrd !== null && !data.is_currently_asleep)
    ? predictions.find(p =>
        p.segment_type === "day_awake" &&
        localOrd(p.start_dt) <= nowOrd &&
        localOrd(p.end_dt) > nowOrd
      ) ?? null
    : null;

  const sleepMinsLeft = sleepPred ? localOrd(sleepPred.end_dt) - nowOrd! : null;
  const awakeMinsLeft = awakePred ? localOrd(awakePred.end_dt) - nowOrd! : null;

  if (data.current_sleep_minutes <= 0 && data.current_awake_minutes <= 0) return null;

  return (
    <>
      {data.is_currently_asleep && data.current_sleep_minutes > 0 && (
        <div style={{ background: "var(--surface2)", borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          {t("chart_currentSleep")} {formatDuration(data.current_sleep_minutes)}
          {sleepPred && sleepMinsLeft !== null && sleepMinsLeft > 0 && (
            <span style={{ color: "var(--muted)", fontSize: "0.9em" }}>
              (~{sleepPred.end_dt.slice(11, 16)}, {t("chart_in")} {formatDuration(sleepMinsLeft)})
            </span>
          )}
        </div>
      )}
      {!data.is_currently_asleep && data.current_awake_minutes > 0 && (
        <div style={{ background: "var(--surface2)", borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          {t("chart_currentAwake")} {formatDuration(data.current_awake_minutes)}
          {awakePred && awakeMinsLeft !== null && awakeMinsLeft > 0 && (
            <span style={{ color: "var(--muted)", fontSize: "0.9em" }}>
              (~{awakePred.end_dt.slice(11, 16)}, {t("chart_in")} {formatDuration(awakeMinsLeft)})
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
  const wakeUpFormatted = wakeUpSource;
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
        <div style={{ color: "var(--muted)" }}>{t("chart_noData")}</div>
      </div>
    );
  }

  return (
    <div>
      <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>

      {data.bedtime && (
        <div style={{ marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          {t("chart_bedtime")} {data.bedtime}
        </div>
      )}

      {currentSeg && (currentSeg.state === "sleep" ? !data.bedtime : currentSeg.start !== wakeUpFormatted) && (
        currentSeg.state === "sleep" ? (
          <div style={{ marginTop: "5px", marginBottom: "5px", maxWidth: "220px", background: "var(--surface2)" }}>
            {t("chart_fellAsleep")} {currentSeg.start}
          </div>
        ) : (
          <div style={{ marginTop: 5, marginBottom: 5 }}>
            {t("chart_wokeUp")} {currentSeg.start}
          </div>
        )
      )}

      {data.segments.map((seg, i) => {
        if (seg.state === "awake" && !seg.is_current) {
          return <div key={i}>{t("chart_awake")} {formatDuration(seg.minutes)}</div>;
        }
        if (seg.state === "sleep" && seg.day_part === "day" && !seg.is_current) {
          return (
            <div key={i} style={{ marginTop: "5px", marginBottom: "5px", maxWidth: "220px", background: "var(--surface2)" }}>
              &nbsp;#{seg.nap_number} &nbsp; {seg.start}–{seg.end} &nbsp; {formatDuration(seg.minutes)}
            </div>
          );
        }
        return null;
      })}

      {wakeUpFormatted != null && (
        <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          {t("chart_wakeUp")} {wakeUpFormatted}
        </div>
      )}

      <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
        <div>{t("chart_totalSleep")} {formatDuration(totalSleep)}</div>
        <div>{t("chart_nightSleep")} {formatDuration(nightSleep)}</div>
        <div>{t("chart_daySleep")} {formatDuration(daySleep)}</div>
        <div>{t("chart_awake")} {formatDuration(totalAwake)}</div>
        {data.cycle_length_minutes != null && (
          <div>{t("chart_cycle")} {formatDuration(cycle)}</div>
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

export default function ChartPage() {
  const { t } = useTranslation();
  const monthNames = t("common_months").split("_");
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
  const [selectedAdditionalIds, setSelectedAdditionalIds] = useState<number[]>([]);
  const [additionalData, setAdditionalData] = useState<Record<string, AdditionalEvent[]>>({});
  const chartRef = useRef<HTMLDivElement>(null);
  const firstBarRef = useRef<HTMLDivElement | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const dashboardFetchedAt = useRef<number>(0);
  const { dateFrom, dateTo } = getLast15Days(todayParam);

  const firstChildId = children[0]?.id;
  const { status, fetchedAt: statusFetchedAt } = useStatus(firstChildId);

  // "now" in the child's local frame, seeded by /api/v2/status (current_min/today)
  // and advanced locally between polls by the minute heartbeat below. No timezone.
  let currentMinutes: number | null = null;
  let todayInTz: string | null = null;
  if (status && typeof status.current_min === "number") {
    const elapsed = todayParam ? 0 : Math.max(0, Math.floor((Date.now() - statusFetchedAt) / 60_000));
    const raw = status.current_min + elapsed;
    currentMinutes = raw % MINUTES_IN_DAY;
    todayInTz = addDays(status.today, Math.floor(raw / MINUTES_IN_DAY));
  }
  const nowOrd = currentMinutes !== null && todayInTz ? dayIndex(todayInTz) * MINUTES_IN_DAY + currentMinutes : null;

  // Local once-a-minute heartbeat: forces a re-render so the render-time "now"
  // values (currentMinutes / todayInTz / nowOrd) advance — the "now" line,
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
    const url = new URL("/api/v2/sleep-predict", window.location.origin);
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
    const url = new URL("/api/v2/chart", window.location.origin);
    url.searchParams.set("child_id", String(childId));
    url.searchParams.set("date_from", from);
    url.searchParams.set("date_to", to);
    additionalIds.forEach((id) => url.searchParams.append("additional_data_ids", String(id)));
    try {
      const r = await authedFetch(url.toString());
      if (!r.ok) { setError(t("chart_loadFailed")); return; }
      const data: ChartResponse = await r.json();
      setRows(data.sleep_data ?? []);
      setAdditionalData(data.additional_data ?? {});
    } catch {
      setError(t("chart_loadFailed"));
    }
  }

  useEffect(() => {
    if (!firstChildId) return;
    loadChart(firstChildId, dateFrom, dateTo, selectedAdditionalIds);
  }, [firstChildId, todayParam, selectedAdditionalIds]);

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
      loadChart(firstChildId, dateFrom, dateTo, selectedAdditionalIds);
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
              <CurrentStatus data={status} predictions={predictEnabled ? predictions : undefined} nowMin={currentMinutes} today={todayInTz} />
            )}
            {visibleLastEvents.map((ev, i) => (
              <div key={i} style={{ background: "var(--surface)", borderRadius: 6, padding: "4px 10px", font: "inherit", display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontWeight: 500 }}>{t(`et_${ev.name}`, ev.name)}</span>
                <span style={{ color: "var(--muted)" }}>{formatDuration(nowOrd !== null ? Math.max(0, nowOrd - localOrd(ev.occurred_at)) : 0)} ago</span>
                {ev.volume != null && <span style={{ color: "var(--muted2)" }}>{ev.volume} ml</span>}
                {ev.description && <span style={{ color: "var(--muted2)" }}>{ev.description}</span>}
              </div>
            ))}
            {visibleLastEvents.length === 0 && (
              <div style={{ background: "var(--surface)", borderRadius: 6, padding: "4px 10px", font: "inherit", color: "var(--muted)" }}>
                {t("chart_noData")}
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
                    {t(`et_${et.name}`, et.name)}
                  </Link>
                );
              })}
              <Link className="qa-btn qa-add-event" to="/add-event">
                {t("nav_addEvent")}
              </Link>
            </div>
          )}
        </div>
      )}

      {dashboard && (
        <div className="dashboard-columns">
          <div className="dashboard-col"><DayColumn title={t("chart_today")} data={dashboard.today} live={!todayParam} fetchedAtMs={dashboardFetchedAt.current} /></div>
          <div className="dashboard-col"><DayColumn title={t("chart_yesterday")} data={dashboard.yesterday} /></div>
          <div className="dashboard-col"><DayColumn title={t("chart_dayBefore")} data={dashboard.day_before_yesterday} /></div>
        </div>
      )}

      {byDay.size > 0 && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "none" }}>
          {t("chart_child")}{" "}
          <select name="child_id" required>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          {t("chart_dateFrom")} <input name="date_from" type="date" defaultValue={dateFrom} required />
        </label>
        <label>
          {t("chart_dateTo")} <input name="date_to" type="date" defaultValue={dateTo} required />
        </label>
        <button type="submit">{t("chart_load")}</button>
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
                  const startMin = localDtToMinutes(seg.start);
                  // end === null → the current unfinished sleep: grow it to "now".
                  let current = false;
                  let endMin: number;
                  if (seg.end === null) {
                    current = true;
                    endMin = currentMinutes ?? startMin;
                  } else {
                    const endMinRaw = localDtToMinutes(seg.end);
                    endMin = endMinRaw === 0 ? MINUTES_IN_DAY : endMinRaw;
                  }
                  const duration = endMin - startMin;
                  const left = (startMin / MINUTES_IN_DAY) * 100;
                  const width = ((endMin - startMin) / MINUTES_IN_DAY) * 100;
                  const titleText = current
                      ? `${formatDuration(duration)} | ${minutesToTimeLabel(startMin)} – `
                      : `${formatDuration(duration)} | ${minutesToTimeLabel(startMin)} – ${minutesToTimeLabel(endMin)}`;
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
                {predictEnabled && day === todayInTz && predictions
                  .filter((p) => p.segment_type !== "day_awake")
                  .filter((p) => {
                    const sd = localDtToDay(p.start_dt);
                    const ed = localDtToDay(p.end_dt);
                    return sd <= todayInTz! && ed >= todayInTz!;
                  })
                  .map((p, i) => {
                    const sd = localDtToDay(p.start_dt);
                    const ed = localDtToDay(p.end_dt);
                    const startMin = sd === todayInTz ? localDtToMinutes(p.start_dt) : 0;
                    const endMin = ed === todayInTz ? localDtToMinutes(p.end_dt) : MINUTES_IN_DAY;
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
                {predictEnabled && day === todayInTz && currentMinutes !== null && status?.is_currently_asleep && (() => {
                  const overlapPred = predictions.find((p) => {
                    if (p.segment_type !== "day_awake") return false;
                    const sd = localDtToDay(p.start_dt);
                    const ed = localDtToDay(p.end_dt);
                    const startMin = sd === todayInTz ? localDtToMinutes(p.start_dt) : 0;
                    const endMin = ed === todayInTz ? localDtToMinutes(p.end_dt) : MINUTES_IN_DAY;
                    return startMin <= currentMinutes! && endMin > currentMinutes!;
                  });
                  if (!overlapPred) return null;
                  const ed = localDtToDay(overlapPred.end_dt);
                  const endMin = ed === todayInTz ? localDtToMinutes(overlapPred.end_dt) : MINUTES_IN_DAY;
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
                      const startMin = localDtToMinutes(ev.occurred_at);
                      const parts: string[] = [];
                      if (ev.description) parts.push(ev.description);
                      if (ev.volume != null) parts.push(String(ev.volume));
                      const title = parts.length ? parts.join(" · ") : minutesToTimeLabel(startMin);
                      const left = (startMin / MINUTES_IN_DAY) * 100;
                      // A `duration` field (number or null) marks a span → draw a line;
                      // null means the event is still running, so grow it to "now".
                      if (ev.duration !== undefined) {
                        const endMin = ev.duration === null ? (currentMinutes ?? startMin) : startMin + ev.duration;
                        const width = Math.max(0, ((Math.min(endMin, MINUTES_IN_DAY) - startMin) / MINUTES_IN_DAY) * 100);
                        return (
                          <div
                            key={ev.id}
                            title={title}
                            style={{
                              position: "absolute",
                              left: `${left}%`,
                              width: `${width}%`,
                              top: "50%",
                              transform: "translateY(-50%)",
                              height: 4,
                              borderRadius: 2,
                              background: color,
                              zIndex: 3,
                            }}
                          />
                        );
                      }
                      return (
                        <div
                          key={ev.id}
                          title={title}
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
        <div style={{ marginTop: 16, color: "var(--muted)" }}>{t("chart_noData")}</div>
      )}
    </div>
  );
}
