export interface SleepItem {
  wake_up?: string;
  sleep_time?: number;
  sleep_start?: string;
  is_day_sleep?: boolean;
}

export interface DayData {
  day_sleeps: SleepItem[];
  night_sleeps: SleepItem[];
  total_sleep_duration: number;
  night_sleep_duration: number;
  day_sleep_duration: number;
  total_awake_duration: number;
  current_sleep?: number;
  current_awake?: number;
  awake_time?: string;
  cycle_length?: number;
  night_sleep_end?: string;
}

export type TimelineEntry =
  | { type: "wake_up";       time: string }
  | { type: "awake";         duration: number }
  | { type: "sleep";         num: number; start: string; end: string; duration: number }
  | { type: "current_sleep"; duration: number }
  | { type: "current_awake"; duration: number }
  | { type: "bedtime";       time: string }

function timeStrToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function stripHour(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${parseInt(h)}:${m}`;
}

function gap(from: string, to: string): number {
  return timeStrToMinutes(to) - timeStrToMinutes(from);
}

// Builds a flat chronological list of timeline events for DayColumn.
// wakeUpFormatted: pre-converted morning wake-up in "H:MM" (caller handles ISO→HH:MM).
export function buildTimeline(
  data: DayData,
  wakeUpFormatted: string | null,
  live: boolean,
  currentMinutes: number | null | undefined,
): TimelineEntry[] {
  const result: TimelineEntry[] = [];
  let prevEnd: string | null = null;
  let sleepNum = 0;

  if (wakeUpFormatted != null) {
    result.push({ type: "wake_up", time: wakeUpFormatted });
    prevEnd = wakeUpFormatted;
  }

  for (const s of data.day_sleeps) {
    if (s.sleep_start) {
      const start = stripHour(s.sleep_start);
      if (prevEnd) {
        const g = gap(prevEnd, start);
        if (g > 0) result.push({ type: "awake", duration: g });
      }
      if (s.wake_up && s.sleep_time) {
        const end = stripHour(s.wake_up);
        result.push({ type: "sleep", num: ++sleepNum, start, end, duration: s.sleep_time });
        prevEnd = end;
      } else {
        prevEnd = start;
      }
    } else if (s.wake_up) {
      const t = stripHour(s.wake_up);
      result.push({ type: "wake_up", time: t });
      prevEnd = t;
    }
  }

  if (live && data.current_sleep != null && currentMinutes != null) {
    const sleepStartMin = (currentMinutes - data.current_sleep + 1440) % 1440;
    const sleepStartStr = `${Math.floor(sleepStartMin / 60)}:${String(sleepStartMin % 60).padStart(2, "0")}`;
    if (prevEnd) {
      const g = gap(prevEnd, sleepStartStr);
      if (g > 0) result.push({ type: "awake", duration: g });
    }
    result.push({ type: "current_sleep", duration: data.current_sleep });
    prevEnd = null;
  } else if (live && data.current_awake != null) {
    result.push({ type: "current_awake", duration: data.current_awake });
  }

  const bedtime = data.night_sleeps.find((s) => s.sleep_start)?.sleep_start;
  if (bedtime) {
    const bt = stripHour(bedtime);
    if (prevEnd) {
      const g = gap(prevEnd, bt);
      if (g > 0) result.push({ type: "awake", duration: g });
    }
    result.push({ type: "bedtime", time: bt });
  }

  return result;
}
