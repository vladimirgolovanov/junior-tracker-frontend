import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import client from "../api/client";
import useChildren from "../hooks/useChildren";
import { useAuthStore } from "../store/auth";

// --- Chart types ---

interface ChartRow {
  day: string;
  start: string;
  end: string;
}

// --- Dashboard types ---

interface SleepItem {
  wake_up?: string;
  awake_time?: number;
  sleep_time?: number;
  sleep_start?: string;
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
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
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

// --- DayColumn component ---

function DayColumn({ title, data }: { title: string; data: DayData }) {
  const bedtime = data.night_sleeps.find((item) => item.sleep_start)?.sleep_start;

  let numberofsleeps: number = 0;
  return (
    <div style={{ flex: 1, lineHeight: 1.6 }}>
      <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>

      {data.day_sleeps.map((item, i) => {
        if (item.sleep_start && item.wake_up && item.sleep_time) {
          numberofsleeps++
          return (
            <div key={i} style={{ marginTop: "5px", marginBottom: "5px", maxWidth: "220px", background: "#EEEEEE" }}>
               #{numberofsleeps}  &nbsp; {item.sleep_start}–{item.wake_up} &nbsp; {formatDuration(item.sleep_time)}
            </div>
          );
        }
        if (item.awake_time) {
          return <div key={i}>Awake {formatDuration(item.awake_time)}</div>;
        }
        if (item.wake_up) {
          return <div key={i} style={{ marginBottom: 8, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>Wake up: {item.wake_up}</div>;
        }
        return null;
      })}

      {bedtime && (
        <div style={{ marginTop: 4 }}>Bedtime: {bedtime}</div>
      )}

      {(data.current_sleep || data.current_awake) ? (
          <div>
            {!!data.current_sleep && (
                <div>Current sleep: {formatDuration(data.current_sleep)}</div>
            )}
            {!!data.current_awake && (
                <div>Current awake: {formatDuration(data.current_awake)}</div>
            )}
          </div>
      ) : null}

      <div style={{ marginTop: 8, borderTop: "1px solid #ddd", paddingTop: 8 }}>
        <div>Total sleep: {formatDuration(data.total_sleep_duration)}</div>
        <div>Night sleep: {formatDuration(data.night_sleep_duration)}</div>
        <div>Day sleep: {formatDuration(data.day_sleep_duration)}</div>
        <div>Awake: {formatDuration(data.total_awake_duration)}</div>
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
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const { dateFrom, dateTo } = getLast15Days(todayParam);

  const firstChildId = children[0]?.id;
  const timezone = children[0]?.timezone;
  const todayInTz = timezone ? getTodayInTz(timezone) : null;
  const currentMinutes = timezone ? getCurrentMinutesInTz(timezone) : null;

  useEffect(() => {
    if (!firstChildId) return;
    const url = new URL("/api/chart/dashboard", window.location.origin);
    url.searchParams.set("child_id", String(firstChildId));
    if (todayParam) url.searchParams.set("today", todayParam);
    fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.today) setDashboard(data as DashboardData);
      })
      .catch(() => {});
  }, [firstChildId, token, todayParam]);

  async function loadChart(childId: number, from: string, to: string) {
    setError("");
    const { data, error: err } = await client.GET("/api/chart/", {
      params: {
        query: {
          child_id: childId,
          date_from: from,
          date_to: to,
          event_type_ids: [1, 2],
        },
      },
    });
    if (err) {
      setError("Failed to load chart data");
      return;
    }
    setRows(Array.isArray(data) ? (data as ChartRow[]) : []);
  }

  useEffect(() => {
    if (!firstChildId) return;
    loadChart(firstChildId, dateFrom, dateTo);
  }, [firstChildId, todayParam]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    loadChart(
      Number(fd.get("child_id")),
      fd.get("date_from") as string,
      fd.get("date_to") as string,
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
      <h1>Chart</h1>

      {dashboard && (
        <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
          <DayColumn title="Today" data={dashboard.today} />
          <DayColumn title="Yesterday" data={dashboard.yesterday} />
          <DayColumn title="Day before yesterday" data={dashboard.day_before_yesterday} />
        </div>
      )}

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
          Date From <input name="date_from" type="date" defaultValue={dateFrom} required />
        </label>
        <label>
          Date To <input name="date_to" type="date" defaultValue={dateTo} required />
        </label>
        <button type="submit">Load</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {byDay.size > 0 && (
        <div style={{ marginTop: 16 }}>
          {[...byDay.entries()].reverse().map(([day, segments]) => (
            <div key={day} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <div style={{ width: 150, flexShrink: 0 }}>{day}</div>
              <div
                style={{
                  flex: 1,
                  height: 20,
                  background: "#eee",
                  position: "relative",
                }}
              >
                {day === todayInTz && currentMinutes !== null && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${(currentMinutes / MINUTES_IN_DAY) * 100}%`,
                      width: 2,
                      height: "100%",
                      background: "black",
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  />
                )}
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
              </div>
            </div>
          ))}
          <div style={{ display: "flex", marginTop: 4 }}>
            <div style={{ width: 150, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between", fontSize: 9, color: "#666" }}>
              {Array.from({ length: 25 }, (_, i) => (
                <span key={i}>{i}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
