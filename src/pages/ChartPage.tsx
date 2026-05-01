import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useChildren from "../hooks/useChildren";
import { useAuthStore } from "../store/auth";

// --- Chart types ---

interface ChartRow {
  day: string;
  start: string;
  end: string;
}

interface EventType {
  id: number;
  name: string;
  format: string;
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

interface SleepItem {
  wake_up?: string;
  sleep_time?: number;
  sleep_start?: string;
  is_day_sleep?: boolean;
}

interface DayData {
  day_sleeps: SleepItem[];
  night_sleeps: SleepItem[];
  total_sleep_duration: number;
  night_sleep_duration: number;
  day_sleep_duration: number;
  total_awake_duration: number;
  current_sleep?: number;
  current_awake?: number;
  awake_time?: string;
  cycle_length?: number;
  night_sleep_end?: string;
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

function formatDuration(minutes: number | undefined | null): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function stripHour(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${parseInt(h)}:${m}`;
}

function timeStrToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PALETTE = ["#e74c3c", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];
const NAME_COLORS: Record<string, string> = {
  food: "#2ecc71",
  poo: "#8B4513",
  formula: "#ff9eb5",
};
function colorForEventType(id: number, name: string): string {
  const key = name.toLowerCase();
  return NAME_COLORS[key] ?? PALETTE[id % PALETTE.length];
}

function formatDayLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]}`;
}

function minutesToTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

// --- DayColumn component ---

function DayColumn({ title, data, live = true, currentMinutes }: { title: string; data: DayData; live?: boolean; currentMinutes?: number | null }) {
  const bedtime = data.night_sleeps.find((item) => item.sleep_start)?.sleep_start;
  const awakeFromNightSleep = data.awake_time;

  // Pre-compute sleep numbers in original order
  const sleepNumbers = new Map<number, number>();
  let count = 0;
  data.day_sleeps.forEach((s, i) => {
    if (s.sleep_start && s.wake_up && s.sleep_time) sleepNumbers.set(i, ++count);
  });

  const reversed = [...data.day_sleeps].reverse();

  return (
    <div>
      <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>

      {live && (!!data.current_sleep || !!data.current_awake) && (
        <div>
          {!!data.current_sleep && (
            <div style={{ marginTop: "5px", marginBottom: "5px", maxWidth: "220px", background: "#EEEEEE", display: "flex", alignItems: "center", gap: 6, padding: "0 6px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#555", flexShrink: 0, animation: "pulse-dot 7s ease-in-out infinite" }} />
              Current sleep: {formatDuration(data.current_sleep)}
            </div>
          )}
          {!!data.current_awake && (
            <div>Current awake: {formatDuration(data.current_awake)}</div>
          )}
        </div>
      )}

      {bedtime && (
        <div style={{ marginTop: 4 }}>Bedtime: {stripHour(bedtime)}</div>
      )}

      {reversed.map((item, j) => {
        const originalIndex = reversed.length - 1 - j;

        // awakeGap = gap between this item's wake_up and the event above it
        const awakeGap = (() => {
          if (!item.wake_up) return null;
          if (j === 0) {
            // most recent sleep: gap up to bedtime or current sleep start
            if (bedtime) return timeStrToMinutes(bedtime) - timeStrToMinutes(item.wake_up);
            if (live && data.current_sleep != null && currentMinutes != null) {
              const sleepStart = (currentMinutes - data.current_sleep + 1440) % 1440;
              return sleepStart - timeStrToMinutes(item.wake_up);
            }
            return null;
          }
          // gap up to the sleep rendered above (reversed[j-1])
          const above = reversed[j - 1];
          if (above?.sleep_start) return timeStrToMinutes(above.sleep_start) - timeStrToMinutes(item.wake_up);
          return null;
        })();

        if (item.sleep_start && item.wake_up && item.sleep_time) {
          const num = sleepNumbers.get(originalIndex);
          return (
            <div key={j}>
              {awakeGap != null && awakeGap > 0 && <div>Awake: {formatDuration(awakeGap)}</div>}
              <div style={{ marginTop: "5px", marginBottom: "5px", maxWidth: "220px", background: "#EEEEEE" }}>
                #{num} &nbsp; {stripHour(item.sleep_start)}–{stripHour(item.wake_up)} &nbsp; {formatDuration(item.sleep_time)}
              </div>
            </div>
          );
        }
        if (item.wake_up) {
          return (
            <div key={j}>
              {awakeGap != null && awakeGap > 0 && <div>Awake: {formatDuration(awakeGap)}</div>}
              <div style={{ marginBottom: 8, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Wake up: {stripHour(item.wake_up)}</div>
            </div>
          );
        }
        return null;
      })}

      {awakeFromNightSleep != null && (
        <div>Wake up: {stripHour(formatTime(awakeFromNightSleep))}</div>
      )}

      <div style={{ marginTop: 8, borderTop: "1px solid #ddd", paddingTop: 8 }}>
        <div>Total sleep: {formatDuration(data.total_sleep_duration)}</div>
        <div>Night sleep: {formatDuration(data.night_sleep_duration)}</div>
        <div>Day sleep: {formatDuration(data.day_sleep_duration)}</div>
        <div>Awake: {formatDuration(data.total_awake_duration)}</div>
        {data.cycle_length != null && (
          <div>Cycle: {formatDuration(data.cycle_length)}</div>
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
  const [searchParams] = useSearchParams();
  const todayParam = searchParams.get("today") ?? undefined;

  const children = useChildren();
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [error, setError] = useState("");
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [selectedAdditionalIds, setSelectedAdditionalIds] = useState<number[]>([]);
  const [additionalData, setAdditionalData] = useState<Record<string, AdditionalEvent[]>>({});
  const chartRef = useRef<HTMLDivElement>(null);
  const firstBarRef = useRef<HTMLDivElement | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const { dateFrom, dateTo } = getLast15Days(todayParam);

  const firstChildId = children[0]?.id;
  const timezone = children[0]?.timezone;
  const todayInTz = timezone ? getTodayInTz(timezone) : null;
  const currentMinutes = timezone ? getCurrentMinutesInTz(timezone) : null;

  useEffect(() => {
    if (!firstChildId) return;

    function fetchDashboard() {
      const url = new URL("/api/chart/dashboard", window.location.origin);
      url.searchParams.set("child_id", String(firstChildId));
      if (todayParam) url.searchParams.set("today", todayParam);
      fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => { if (data?.today) setDashboard(data as DashboardData); })
        .catch(() => {});
    }

    fetchDashboard();
    const id = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(id);
  }, [firstChildId, token, todayParam]);

  useEffect(() => {
    if (!token || !firstChildId) return;
    const url = new URL("/api/event_types/", window.location.origin);
    url.searchParams.set("child_id", String(firstChildId));
    fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: EventType[]) => setEventTypes(data))
      .catch(() => {});
  }, [token, firstChildId]);

  async function loadChart(childId: number, from: string, to: string, additionalIds: number[] = []) {
    setError("");
    const url = new URL("/api/chart/", window.location.origin);
    url.searchParams.set("child_id", String(childId));
    url.searchParams.set("date_from", from);
    url.searchParams.set("date_to", to);
    [1, 2].forEach((id) => url.searchParams.append("event_type_ids", String(id)));
    additionalIds.forEach((id) => url.searchParams.append("additional_data_ids", String(id)));
    try {
      const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { setError("Failed to load chart data"); return; }
      const data: ChartResponse = await r.json();
      setRows(data.sleep_data ?? []);
      setAdditionalData(data.additional_data ?? {});
    } catch {
      setError("Failed to load chart data");
    }
  }

  useEffect(() => {
    if (!firstChildId) return;
    loadChart(firstChildId, dateFrom, dateTo, selectedAdditionalIds);
    const id = setInterval(() => loadChart(firstChildId, dateFrom, dateTo, selectedAdditionalIds), 60_000);
    return () => clearInterval(id);
  }, [firstChildId, todayParam, selectedAdditionalIds]);

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

  return (
    <div>
      {dashboard && (
        <div className="dashboard-columns">
          <div className="dashboard-col"><DayColumn title="Today" data={dashboard.today} live={!todayParam} currentMinutes={currentMinutes} /></div>
          <div className="dashboard-col"><DayColumn title="Yesterday" data={dashboard.yesterday} /></div>
          <div className="dashboard-col"><DayColumn title="Day before" data={dashboard.day_before_yesterday} /></div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "none" }}>
          Child{" "}
          <select name="child_id" required>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date from <input name="date_from" type="date" defaultValue={dateFrom} required />
        </label>
        <label>
          Date to <input name="date_to" type="date" defaultValue={dateTo} required />
        </label>
        <button type="submit">Load</button>
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {eventTypes
          .filter((et) => et.format !== "range" && et.format !== "range_end")
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
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colorForEventType(et.id, et.name) }} />
              {et.name}
            </label>
          ))}
      </div>
      </div>

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
            <div style={{ flexShrink: 0, paddingRight: 8, whiteSpace: "nowrap", visibility: "hidden", fontSize: 9 }}>30 Apr</div>
            <div style={{ flex: 1, position: "relative", height: 12, fontSize: 9, color: "#bbb" }}>
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
            <div key={day} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <div style={{ flexShrink: 0, paddingRight: 8, whiteSpace: "nowrap", fontSize: 9, color: "#bbb" }}>{formatDayLabel(day)}</div>
              <div
                ref={(el) => { if (index === 0 && el) firstBarRef.current = el; }}
                style={{
                  flex: 1,
                  height: 20,
                  background: "#eee",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
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
                          background: "black",
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
                          color: "black",
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
                  let endMin = endMinRaw === 0 ? MINUTES_IN_DAY : endMinRaw;
                  if (day === todayInTz && currentMinutes !== null && endMin > currentMinutes) {
                    endMin = currentMinutes;
                  }
                  const left = (startMin / MINUTES_IN_DAY) * 100;
                  const width = ((endMin - startMin) / MINUTES_IN_DAY) * 100;
                  return (
                    <div
                      key={i}
                      title={`${formatTime(seg.start)} – ${formatTime(seg.end)}`}
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
                {Object.entries(additionalData).flatMap(([typeIdStr, events]) => {
                  const typeId = Number(typeIdStr);
                  const etName = eventTypes.find((et) => et.id === typeId)?.name ?? "";
                  const color = colorForEventType(typeId, etName);
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
            <div style={{ flexShrink: 0, paddingRight: 8, whiteSpace: "nowrap", visibility: "hidden", fontSize: 9 }}>30 Apr</div>
            <div style={{ flex: 1, position: "relative", height: 12, fontSize: 9, color: "#bbb" }}>
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
                    background: "rgba(0,0,0,0.5)",
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
                    color: "black",
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
    </div>
  );
}
