import { FormEvent, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import client from "../api/client";
import useChildren from "../hooks/useChildren";
import { useEventTypesStore } from "../store/eventTypes";

function getNowLocal(): string {
  const d = new Date();
  d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Layout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const children = useChildren();
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const firstChildId = children[0]?.id;
  const eventTypes = useEventTypesStore((s) => s.eventTypes);
  const loadEventTypes = useEventTypesStore((s) => s.load);

  useEffect(() => {
    if (!token || !firstChildId) return;
    loadEventTypes(token, firstChildId);
  }, [token, firstChildId, loadEventTypes]);

  async function handleLogout() {
    await client.POST("/auth/logout");
    logout();
    navigate("/login");
  }

  async function handleAddEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const occurredAt = fd.get("occurred_at") as string;
    const body = {
      child_id: Number(fd.get("child_id")),
      event_type_id: Number(fd.get("event_type_id")),
      occurred_at: new Date(occurredAt).toISOString(),
      description: (fd.get("description") as string) || null,
      volume: fd.get("volume") ? Number(fd.get("volume")) : null,
    };
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await fetch("/api/events/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed");
      setShowModal(false);
    } catch {
      setSubmitError("Failed to save event");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {token ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>Junior tracker</span>
              <button type="button" onClick={() => setShowModal(true)}>
                Add event
              </button>
            </div>
{/*            <Link to="/chart">Chart</Link> |{" "}*/}
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link> | <Link to="/register">Register</Link>
          </>
        )}
      </nav>
      <hr />
      <Outlet />

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ background: "#fff", padding: 24, minWidth: 320, maxWidth: 440, width: "90%", marginTop: "env(safe-area-inset-top, 0px)" }}>
            <h2 style={{ margin: "0 0 16px" }}>Add event</h2>
            <form onSubmit={handleAddEvent} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="hidden" name="child_id" value={firstChildId ?? ""} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span>Event type</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {eventTypes.map((et) => (
                    <label key={et.id} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input type="radio" name="event_type_id" value={et.id} required />
                      {et.name}
                    </label>
                  ))}
                </div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Time
                <input name="occurred_at" type="datetime-local" defaultValue={getNowLocal()} step={300} required />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Description
                <input name="description" type="text" placeholder="Optional" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Volume (ml)
                <input name="volume" type="number" min={0} placeholder="Optional" />
              </label>
              {submitError && <div style={{ color: "red" }}>{submitError}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
