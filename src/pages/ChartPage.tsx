import { FormEvent, useEffect, useState } from "react";
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
  awake_time?: string;
  sleep_time?: string;
  sleep_start?: string;
}

interface DayData {
  day_sleeps: SleepItem[];
  night_sleeps: SleepItem[];
  total_sleep_duration: string;
  night_sleep_duration: string;
  day_sleep_duration: string;
  total_awake_duration: string;
  current_sleep?: string;
  current_awake?: string;
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
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Parse "2h 25m", "35m", "0m" into { h, m } */
function parseDuration(s: string): { h: number; m: number } {
  const hMatch = s.match(/(\d+)h/);
  const mMatch = s.match(/(\d+)m/);
  return { h: hMatch ? parseInt(hMatch[1]) : 0, m: mMatch ? parseInt(mMatch[1]) : 0 };
}

function formatDuration(s: string): string {
  const { h, m } = parseDuration(s);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(" ") || "0m";
}

// --- DayColumn component ---

function DayColumn({ title, data }: { title: string; data: DayData }) {
  const bedtime = data.night_sleeps.find((item) => item.sleep_start)?.sleep_start;

  return (
    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.6 }}>
      <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>

      {data.day_sleeps.map((item, i) => {
        if (item.sleep_start && item.wake_up && item.sleep_time) {
          return (
            <div key={i}>
              {item.sleep_start}–{item.wake_up} ({formatDuration(item.sleep_time)})
            </div>
          );
        }
        if (item.awake_time) {
          return <div key={i}>Awake {formatDuration(item.awake_time)}</div>;
        }
        if (item.wake_up) {
          return <div key={i}>Wake up: {item.wake_up}</div>;
        }
        return null;
      })}

      {bedtime && (
        <div style={{ marginTop: 4 }}>Bedtime: {bedtime}</div>
      )}

      {(data.current_sleep && data.current_sleep !== "0m") || (data.current_awake && data.current_awake !== "0m") ? (
          <div>
            {data.current_sleep && data.current_sleep !== "0m" && (
                <div>Current sleep: {formatDuration(data.current_sleep)}</div>
            )}
            {data.current_awake && data.current_awake !== "0m" && (
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

function getLast15Days(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 14);
  return { dateFrom: toDateString(from), dateTo: toDateString(today) };
}

export default function ChartPage() {
  const children = useChildren();
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const { dateFrom, dateTo } = getLast15Days();

  const firstChildId = children[0]?.id;

  useEffect(() => {
    if (!firstChildId) return;
    fetch(`/api/chart/dashboard?child_id=${firstChildId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.today) setDashboard(data as DashboardData);
      })
      .catch(() => {});
  }, [firstChildId, token]);

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
  }, [firstChildId]);

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

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Child{" "}
            <select name="child_id" required>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Date From <input name="date_from" type="date" defaultValue={dateFrom} required />
          </label>
        </div>
        <div>
          <label>
            Date To <input name="date_to" type="date" defaultValue={dateTo} required />
          </label>
        </div>
        <button type="submit">Load</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {byDay.size > 0 && (
        <div style={{ marginTop: 16 }}>
          {[...byDay.entries()].map(([day, segments]) => (
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
                {segments.map((seg, i) => {
                  const startMin = timeToMinutes(seg.start);
                  const endMinRaw = timeToMinutes(seg.end);
                  const endMin = endMinRaw === 0 ? MINUTES_IN_DAY : endMinRaw;
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
