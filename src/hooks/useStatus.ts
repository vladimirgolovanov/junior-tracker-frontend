import { useEffect, useState } from "react";
import { authedFetch } from "../api/client";
import { useAuthStore } from "../store/auth";

// One event as surfaced in the "last events" block.
export interface StatusEvent {
  event_type_id: number;
  name: string;
  occurred_at: string;
  volume: number | null;
  description: string | null;
}

// A ready-to-render action. The backend resolves each range pair
// (open → its *_end, closed → its *_start) so the frontend never reasons about
// pairing or the asleep state. `focus` mirrors the existing ?focus= autofocus;
// `volumes` are suggested amounts (from history) for volume-input types;
// `show_in_quick_actions` marks which actions surface as quick-add buttons.
export interface Action {
  event_type_id: number;
  focus: "volume" | "description" | null;
  volumes?: number[];
  show_in_quick_actions: boolean;
}

export interface Status {
  child_id: number;
  is_currently_asleep: boolean;
  current_sleep_minutes: number;
  current_awake_minutes: number;
  last_events: StatusEvent[];
  actions: Action[];
}

// Polls the shared /api/v2/status "pulse" endpoint once a minute. Returns null
// until the first successful load (or while the endpoint is unavailable).
export default function useStatus(childId: number | undefined): Status | null {
  const token = useAuthStore((s) => s.token);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;

    function fetchStatus() {
      const url = new URL("/api/v2/status", window.location.origin);
      url.searchParams.set("child_id", String(childId));
      authedFetch(url.toString())
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data && typeof data.is_currently_asleep === "boolean") {
            setStatus(data as Status);
          }
        })
        .catch(() => {});
    }

    fetchStatus();
    const id = setInterval(fetchStatus, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [childId, token]);

  return status;
}
