import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import Picker from "react-mobile-picker";
import { useAuthStore } from "../store/auth";
import client from "../api/client";
import useChildren from "../hooks/useChildren";
import { useEventTypesStore } from "../store/eventTypes";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i));
const MINUTES = ["00","05","10","15","20","25","30","35","40","45","50","55"];

interface DayOption {
  label: string;
  date: string;
}

function buildDayOptions(): DayOption[] {
  const now = new Date();
  const opts: DayOption[] = [];
  for (let i = -7; i <= 1; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    opts.push({
      label: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`,
      date: [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"),
    });
  }
  return opts;
}

function nowPickerValue(): { day: string; hour: string; minute: string } {
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
    day: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`,
    hour: String(d.getHours()),
    minute: String(d.getMinutes()).padStart(2, "0"),
  };
}

const DAY_OPTIONS = buildDayOptions();

export default function Layout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const children = useChildren();
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [pickerValue, setPickerValue] = useState<{ day: string; hour: string; minute: string }>(nowPickerValue());
  const [description, setDescription] = useState("");
  const [volume, setVolume] = useState("");
  const [isCurrentAsleep, setIsCurrentAsleep] = useState<boolean | null>(null);

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

  function openModal() {
    setSelectedTypeId(null);
    setPickerValue(nowPickerValue());
    setDescription("");
    setVolume("");
    setSubmitError("");
    setIsCurrentAsleep(null);
    setShowModal(true);

    if (token && firstChildId) {
      const url = new URL("/api/chart/dashboard", window.location.origin);
      url.searchParams.set("child_id", String(firstChildId));
      fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data?.today?.is_current_asleep === "boolean") {
            setIsCurrentAsleep(data.today.is_current_asleep);
          }
        })
        .catch(() => {});
    }
  }

  // range shown only when NOT currently asleep; range_end shown only when currently asleep; others always
  const filteredTypes = eventTypes.filter((et) => {
    if (et.format === "range") return isCurrentAsleep !== true;
    if (et.format === "range_end") return isCurrentAsleep !== false;
    return true;
  });

  const selectedType = eventTypes.find((et) => et.id === selectedTypeId);

  async function handleAddEvent() {
    if (!selectedTypeId) return;
    const dayEntry = DAY_OPTIONS.find((d) => d.label === pickerValue.day);
    if (!dayEntry) return;
    const isoLocal = `${dayEntry.date}T${pickerValue.hour.padStart(2, "0")}:${pickerValue.minute}:00`;
    const body = {
      child_id: firstChildId,
      event_type_id: selectedTypeId,
      occurred_at: new Date(isoLocal).toISOString(),
      description: selectedType?.describe_input ? description || null : null,
      volume: selectedType?.volume_input && volume ? Number(volume) : null,
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
              <button type="button" onClick={openModal}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span>Event type</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {filteredTypes.map((et) => (
                    <label key={et.id} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="event_type_id"
                        value={et.id}
                        checked={selectedTypeId === et.id}
                        onChange={() => setSelectedTypeId(et.id)}
                      />
                      {et.name}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ marginBottom: 4 }}>Time</div>
                <Picker
                  value={pickerValue}
                  onChange={(v) => setPickerValue(v as typeof pickerValue)}
                  height={180}
                  itemHeight={36}
                  wheelMode="natural"
                >
                  <Picker.Column name="day">
                    {DAY_OPTIONS.map((d) => (
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

              {selectedType?.describe_input && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  Description
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              )}

              {selectedType?.volume_input && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  Volume (ml)
                  <input
                    type="number"
                    min={0}
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              )}

              {submitError && <div style={{ color: "red" }}>{submitError}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="button" disabled={!selectedTypeId || submitting} onClick={handleAddEvent}>
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
