import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";
import { useChildrenStore } from "../store/children";
import { useEventTypesStore } from "../store/eventTypes";

interface FreshChild {
  id: number;
  name: string;
  timezone?: string;
}

interface SettingsEventType {
  id: number;
  name: string;
  format: string;
  color: string | null;
  keywords: string[] | null;
  child_id: number;
  parent_id: number | null;
}

interface RowEdit {
  name: string;
  color: string;
  keywords: string;
}

export default function ChildSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const resetChildren = useChildrenStore((s) => s.reset);
  const resetEventTypes = useEventTypesStore((s) => s.reset);

  const [children, setChildren] = useState<FreshChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [childName, setChildName] = useState("");
  const [childTimezone, setChildTimezone] = useState("");
  const [childSaveError, setChildSaveError] = useState<string | null>(null);
  const [childSaving, setChildSaving] = useState(false);

  const [eventTypes, setEventTypes] = useState<SettingsEventType[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [etLoading, setEtLoading] = useState(false);

  const [rowEdits, setRowEdits] = useState<Record<number, RowEdit>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [rowSaving, setRowSaving] = useState<Record<number, boolean>>({});

  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [newSaving, setNewSaving] = useState(false);

  useEffect(() => {
    fetch("/api/children/", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: FreshChild[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setChildren(data);
          setSelectedChildId(data[0].id);
          setChildName(data[0].name);
          setChildTimezone(data[0].timezone ?? "");
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    fetch("/api/event_types/formats", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFormats(data);
          setNewFormat(data[0] ?? "");
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (selectedChildId === null) return;
    setEtLoading(true);
    const url = new URL("/api/event_types/", window.location.origin);
    url.searchParams.set("child_id", String(selectedChildId));
    fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEventTypes(data);
          const edits: Record<number, RowEdit> = {};
          for (const et of data as SettingsEventType[]) {
            edits[et.id] = {
              name: et.name,
              color: et.color ?? "",
              keywords: et.keywords?.join(", ") ?? "",
            };
          }
          setRowEdits(edits);
          setRowErrors({});
        }
      })
      .catch(() => {})
      .finally(() => setEtLoading(false));
  }, [selectedChildId, token]);

  function selectChild(child: { id: number; name: string; timezone?: string }) {
    setSelectedChildId(child.id);
    setChildName(child.name);
    setChildTimezone(child.timezone ?? "");
    setChildSaveError(null);
  }

  async function saveChild() {
    if (selectedChildId === null) return;
    setChildSaving(true);
    setChildSaveError(null);
    try {
      const r = await fetch(`/api/children/${selectedChildId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: childName, timezone: childTimezone || undefined }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setChildSaveError(body?.detail ?? `Error ${r.status}`);
      } else {
        resetChildren();
      }
    } catch {
      setChildSaveError("Network error");
    } finally {
      setChildSaving(false);
    }
  }

  function updateRow(id: number, field: keyof RowEdit, value: string) {
    setRowEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveRow(id: number) {
    const edit = rowEdits[id];
    if (!edit) return;
    setRowSaving((prev) => ({ ...prev, [id]: true }));
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const keywords = edit.keywords
        ? edit.keywords.split(",").map((k) => k.trim()).filter(Boolean)
        : [];
      const r = await fetch(`/api/event_types/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: edit.name,
          color: edit.color || null,
          keywords: keywords.length ? keywords : null,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setRowErrors((prev) => ({ ...prev, [id]: body?.detail ?? `Error ${r.status}` }));
      } else {
        const updated: SettingsEventType = await r.json();
        setEventTypes((prev) => prev.map((et) => (et.id === id ? updated : et)));
        resetEventTypes();
      }
    } catch {
      setRowErrors((prev) => ({ ...prev, [id]: "Network error" }));
    } finally {
      setRowSaving((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function createEventType(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newFormat || selectedChildId === null) return;
    setNewSaving(true);
    setNewError(null);
    try {
      const keywords = newKeywords
        ? newKeywords.split(",").map((k) => k.trim()).filter(Boolean)
        : undefined;
      const r = await fetch("/api/event_types/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          child_id: selectedChildId,
          name: newName,
          format: newFormat,
          color: newColor || null,
          keywords: keywords?.length ? keywords : null,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setNewError(body?.detail ?? `Error ${r.status}`);
      } else {
        const created: SettingsEventType = await r.json();
        setEventTypes((prev) => [...prev, created]);
        setRowEdits((prev) => ({
          ...prev,
          [created.id]: {
            name: created.name,
            color: created.color ?? "",
            keywords: created.keywords?.join(", ") ?? "",
          },
        }));
        resetEventTypes();
        setNewName("");
        setNewColor("");
        setNewKeywords("");
      }
    } catch {
      setNewError("Network error");
    } finally {
      setNewSaving(false);
    }
  }

  if (children.length === 0) {
    return <p>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px" }}>
      <h2>Settings</h2>

      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectChild(c)}
              style={{ fontWeight: selectedChildId === c.id ? "bold" : "normal" }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <section style={{ marginBottom: 32 }}>
        <h3>Child info</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300 }}>
          <label>
            Name
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label>
            Timezone
            <select
              value={childTimezone}
              onChange={(e) => setChildTimezone(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              {((Intl as any).supportedValuesOf("timeZone") as string[]).map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={saveChild} disabled={childSaving}>
              {childSaving ? "Saving..." : "Save"}
            </button>
            {childSaveError && <span style={{ color: "red" }}>{childSaveError}</span>}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3>Event types</h3>
        {etLoading ? (
          <p>Loading...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Format</th>
                <th style={th}>Color</th>
                <th style={th}>Keywords</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {eventTypes.map((et) => {
                const edit = rowEdits[et.id];
                if (!edit) return null;
                return (
                  <tr key={et.id}>
                    <td style={td}>
                      <input
                        value={edit.name}
                        onChange={(e) => updateRow(et.id, "name", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 12, color: "#666" }}>{et.format}</span>
                    </td>
                    <td style={td}>
                      <input
                        value={edit.color}
                        onChange={(e) => updateRow(et.id, "color", e.target.value)}
                        placeholder="rrggbb"
                        style={{ width: 80 }}
                      />
                    </td>
                    <td style={td}>
                      <input
                        value={edit.keywords}
                        onChange={(e) => updateRow(et.id, "keywords", e.target.value)}
                        placeholder="comma separated"
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => saveRow(et.id)}
                        disabled={rowSaving[et.id]}
                      >
                        {rowSaving[et.id] ? "..." : "Save"}
                      </button>
                      {rowErrors[et.id] && (
                        <div style={{ color: "red", fontSize: 11 }}>{rowErrors[et.id]}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Add event type</h3>
        <form onSubmit={createEventType} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300 }}>
          <label>
            Name *
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label>
            Format *
            <select
              value={newFormat}
              onChange={(e) => setNewFormat(e.target.value)}
              required
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              {formats.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Color
            <input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="rrggbb"
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label>
            Keywords
            <input
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              placeholder="comma separated"
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="submit" disabled={newSaving}>
              {newSaving ? "Adding..." : "Add"}
            </button>
            {newError && <span style={{ color: "red" }}>{newError}</span>}
          </div>
        </form>
      </section>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  borderBottom: "1px solid #ccc",
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: "4px 8px",
  verticalAlign: "top",
};
