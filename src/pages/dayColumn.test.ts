import { describe, it, expect } from "vitest";
import { buildTimeline, type DayData } from "./dayColumn";

function makeDay(overrides: Partial<DayData> = {}): DayData {
  return {
    day_sleeps: [],
    night_sleeps: [],
    total_sleep_duration: 0,
    night_sleep_duration: 0,
    day_sleep_duration: 0,
    total_awake_duration: 0,
    ...overrides,
  };
}

describe("buildTimeline", () => {
  it("empty day", () => {
    expect(buildTimeline(makeDay(), null, false, null)).toEqual([]);
  });

  it("only wake_up, no naps, no bedtime", () => {
    expect(buildTimeline(makeDay(), "7:00", false, null)).toEqual([
      { type: "wake_up", time: "7:00" },
    ]);
  });

  it("wake_up + one nap + bedtime", () => {
    const data = makeDay({
      day_sleeps: [{ sleep_start: "09:00", wake_up: "10:30", sleep_time: 90 }],
      night_sleeps: [{ sleep_start: "20:00" }],
    });
    expect(buildTimeline(data, "7:00", false, null)).toEqual([
      { type: "wake_up", time: "7:00" },
      { type: "awake", duration: 120 },           // 7:00 → 9:00
      { type: "sleep", num: 1, start: "9:00", end: "10:30", duration: 90 },
      { type: "awake", duration: 570 },           // 10:30 → 20:00
      { type: "bedtime", time: "20:00" },
    ]);
  });

  it("wake_up + two naps + bedtime", () => {
    const data = makeDay({
      day_sleeps: [
        { sleep_start: "09:00", wake_up: "10:00", sleep_time: 60 },
        { sleep_start: "13:00", wake_up: "14:00", sleep_time: 60 },
      ],
      night_sleeps: [{ sleep_start: "20:00" }],
    });
    expect(buildTimeline(data, "7:00", false, null)).toEqual([
      { type: "wake_up", time: "7:00" },
      { type: "awake", duration: 120 },           // 7:00 → 9:00
      { type: "sleep", num: 1, start: "9:00", end: "10:00", duration: 60 },
      { type: "awake", duration: 180 },           // 10:00 → 13:00
      { type: "sleep", num: 2, start: "13:00", end: "14:00", duration: 60 },
      { type: "awake", duration: 360 },           // 14:00 → 20:00
      { type: "bedtime", time: "20:00" },
    ]);
  });

  it("live: current_sleep after nap, with awake gap", () => {
    const data = makeDay({
      day_sleeps: [{ sleep_start: "09:00", wake_up: "10:00", sleep_time: 60 }],
      current_sleep: 30,
    });
    // currentMinutes=750 (12:30), sleepStart = 750-30 = 720 = 12:00
    expect(buildTimeline(data, "7:00", true, 750)).toEqual([
      { type: "wake_up", time: "7:00" },
      { type: "awake", duration: 120 },           // 7:00 → 9:00
      { type: "sleep", num: 1, start: "9:00", end: "10:00", duration: 60 },
      { type: "awake", duration: 120 },           // 10:00 → 12:00
      { type: "current_sleep", duration: 30 },
    ]);
  });

  it("live: current_awake after nap", () => {
    const data = makeDay({
      day_sleeps: [{ sleep_start: "09:00", wake_up: "10:00", sleep_time: 60 }],
      current_awake: 90,
    });
    expect(buildTimeline(data, "7:00", true, null)).toEqual([
      { type: "wake_up", time: "7:00" },
      { type: "awake", duration: 120 },
      { type: "sleep", num: 1, start: "9:00", end: "10:00", duration: 60 },
      { type: "current_awake", duration: 90 },
    ]);
  });

  it("live: current_sleep with no naps yet", () => {
    const data = makeDay({ current_sleep: 30 });
    // currentMinutes=450 (7:30), sleepStart = 450-30 = 420 = 7:00
    expect(buildTimeline(data, "6:00", true, 450)).toEqual([
      { type: "wake_up", time: "6:00" },
      { type: "awake", duration: 60 },            // 6:00 → 7:00
      { type: "current_sleep", duration: 30 },
    ]);
  });

  it("gap = 0 is not inserted (nap starts at same time as wake_up)", () => {
    const data = makeDay({
      day_sleeps: [{ sleep_start: "07:00", wake_up: "08:00", sleep_time: 60 }],
    });
    expect(buildTimeline(data, "7:00", false, null)).toEqual([
      { type: "wake_up", time: "7:00" },
      { type: "sleep", num: 1, start: "7:00", end: "8:00", duration: 60 },
    ]);
  });

  it("live=false: current_sleep and current_awake are ignored", () => {
    const data = makeDay({ current_sleep: 30, current_awake: 60 });
    expect(buildTimeline(data, "7:00", false, null)).toEqual([
      { type: "wake_up", time: "7:00" },
    ]);
  });
});
