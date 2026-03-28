import { useEffect, useState, FormEvent } from "react";
import client from "../api/client";
import useChildren from "../hooks/useChildren";

export default function EventsPage() {
  const children = useChildren();
  const [childId, setChildId] = useState<number | null>(null);
  const [events, setEvents] = useState<unknown[]>([]);
  const [error, setError] = useState("");

  // Auto-select first child when loaded
  useEffect(() => {
    if (children.length > 0 && childId === null) {
      setChildId(children[0].id);
    }
  }, [children]);

  async function loadEvents() {
    if (childId === null) return;
    const { data, error: err } = await client.GET("/api/events/", {
      params: { query: { child_id: childId } },
    });
    if (err) {
      setError("Failed to load events");
      return;
    }
    setEvents(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadEvents();
  }, [childId]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await client.POST("/api/events/", {
      body: {
        child_id: childId!,
        event_type_id: Number(fd.get("event_type_id")),
        occurred_at: new Date(fd.get("occurred_at") as string).toISOString(),
        description: (fd.get("description") as string) || null,
        volume: fd.get("volume") ? Number(fd.get("volume")) : null,
      },
    });
    e.currentTarget.reset();
    loadEvents();
  }

  return (
    <div>
      <h1>Events</h1>
      <div>
        <label>
          Child:{" "}
          <select
            value={childId ?? ""}
            onChange={(e) => setChildId(Number(e.target.value))}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      <h2>Add Event</h2>
      <form onSubmit={handleCreate}>
        <div>
          <label>
            Event Type ID <input name="event_type_id" type="number" required min={1} />
          </label>
        </div>
        <div>
          <label>
            Occurred At <input name="occurred_at" type="datetime-local" required />
          </label>
        </div>
        <div>
          <label>
            Description <input name="description" type="text" />
          </label>
        </div>
        <div>
          <label>
            Volume <input name="volume" type="number" />
          </label>
        </div>
        <button type="submit">Create</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>Event List</h2>
      {events.length === 0 ? (
        <p>No events</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Occurred At</th>
              <th>Description</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev: any) => (
              <tr key={ev.id}>
                <td>{ev.id}</td>
                <td>{ev.event_type_id}</td>
                <td>{ev.occurred_at}</td>
                <td>{ev.description ?? "-"}</td>
                <td>{ev.volume ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
