import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { useChildrenStore } from "../store/children";
import { authedFetch } from "../api/client";
import BarChart from "../components/BarChart";

interface DayAnalytics {
  date: string;
  data: {
    cycle_length: number;
    day_sleep_duration: number;
    night_sleep_duration: number;
    total_awake_duration: number;
  };
}

export default function SleepPage() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const children = useChildrenStore((s) => s.children);
  const [childId, setChildId] = useState<number | null>(null);
  const [days, setDays] = useState<DayAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (children.length > 0 && childId === null) {
      setChildId(children[0].id);
    }
  }, [children, childId]);

  useEffect(() => {
    if (childId === null || !token) return;
    setLoading(true);
    setError(null);
    authedFetch(`/api/analytics/daily?child_id=${childId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: DayAnalytics[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        // Drop the newest day (today is still in progress and skews the chart);
        // shift the 14-day window one day back so the day count stays the same.
        setDays(sorted.slice(1, 15));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [childId, token]);

  const sections: { key: keyof DayAnalytics["data"]; label: string; color: string }[] = [
    { key: "cycle_length", label: t("stats_cycleLength"), color: "#6c8ebf" },
    { key: "day_sleep_duration", label: t("stats_daySleep"), color: "#82b366" },
    { key: "night_sleep_duration", label: t("stats_nightSleep"), color: "#4a4a8a" },
    { key: "total_awake_duration", label: t("stats_totalAwake"), color: "#d6a84e" },
  ];

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h2>{t("sleep_title")}</h2>
        {children.length > 1 && (
          <select
            value={childId ?? ""}
            onChange={(e) => setChildId(Number(e.target.value))}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <p>{t("settings_loading")}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && days.length > 0 && (
        <div className="stats-sections">
          {sections.map((s) => (
            <div key={s.key} className="stats-section">
              <h3 className="stats-section-title">{s.label}</h3>
              <BarChart
                days={days.map((d) => ({ date: d.date, value: d.data[s.key] }))}
                color={s.color}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
