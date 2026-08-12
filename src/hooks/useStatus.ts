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
  // Child-local "now" at response time: minute-of-day (0..1439) and the date.
  current_min: number;
  today: string;
  last_events: StatusEvent[];
  actions: Action[];
}

// Polls the shared /api/v2/status "pulse" endpoint once a minute. `status` is null
// until the first successful load; `fetchedAt` is Date.now() of that load so the
// caller can advance current_min locally between polls.
export default function useStatus(
  childId: number | undefined,
): { status: Status | null; fetchedAt: number } {
  const token = useAuthStore((s) => s.token);
  const [status, setStatus] = useState<Status | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    let lastFetch = 0;

    function fetchStatus() {
      lastFetch = Date.now();
      const url = new URL("/api/v2/status", window.location.origin);
      url.searchParams.set("child_id", String(childId));
      authedFetch(url.toString())
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data && typeof data.is_currently_asleep === "boolean") {
            setStatus(data as Status);
            setFetchedAt(Date.now());
          }
        })
        .catch(() => {});
    }

    fetchStatus();
    const id = setInterval(fetchStatus, 60_000);

    // Background tabs (esp. iOS Safari) freeze the interval, so re-poll as soon as
    // the tab becomes visible again — otherwise the first seconds show a stale
    // status. The 5s guard dedups near-simultaneous visibility/pageshow triggers
    // and avoids piling onto a poll that just landed.
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetch < 5_000) return;
      fetchStatus();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible); // iOS bfcache restore

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [childId, token]);

  return { status, fetchedAt };
}
