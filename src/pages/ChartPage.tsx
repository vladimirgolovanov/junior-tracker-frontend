import { FormEvent, useState } from "react";
import client from "../api/client";
import useChildren from "../hooks/useChildren";

interface ChartRow {
  day: string;
  start: string;
  end: string;
}

function timeToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const MINUTES_IN_DAY = 24 * 60;

export default function ChartPage() {
  const children = useChildren();
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    const { data, error: err } = await client.GET("/api/chart/", {
      params: {
        query: {
          child_id: Number(fd.get("child_id")),
          date_from: fd.get("date_from") as string,
          date_to: fd.get("date_to") as string,
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
            Date From <input name="date_from" type="date" required />
          </label>
        </div>
        <div>
          <label>
            Date To <input name="date_to" type="date" required />
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
                  const endMin = timeToMinutes(seg.end);
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
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666" }}>
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
