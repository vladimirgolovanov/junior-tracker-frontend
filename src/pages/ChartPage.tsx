import { FormEvent, useState } from "react";
import client from "../api/client";

export default function ChartPage() {
  const [chartData, setChartData] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    const eventTypeIds = (fd.get("event_type_ids") as string)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));

    if (eventTypeIds.length === 0) {
      setError("Enter at least one event type ID");
      return;
    }

    const { data, error: err } = await client.GET("/api/chart/", {
      params: {
        query: {
          child_id: Number(fd.get("child_id")),
          date_from: fd.get("date_from") as string,
          date_to: fd.get("date_to") as string,
          event_type_ids: eventTypeIds,
        },
      },
    });

    if (err) {
      setError("Failed to load chart data");
      return;
    }
    setChartData(JSON.stringify(data, null, 2));
  }

  return (
    <div>
      <h1>Chart</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Child ID <input name="child_id" type="number" required min={1} defaultValue={1} />
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
        <div>
          <label>
            Event Type IDs (comma-separated){" "}
            <input name="event_type_ids" type="text" required placeholder="1,2,3" />
          </label>
        </div>
        <button type="submit">Load</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {chartData !== null && (
        <pre style={{ maxHeight: 400, overflow: "auto" }}>{chartData}</pre>
      )}
    </div>
  );
}
