import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { useChildrenStore } from "../store/children";
import { authedFetch } from "../api/client";

interface DayAnalytics {
  date: string;
  data: {
    cycle_length: number;
    day_sleep_duration: number;
    night_sleep_duration: number;
    total_awake_duration: number;
  };
}

interface FormulaDay {
  date: string;
  total_volume: number;
  count: number;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

function fmtDuration(minutes: number): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h\n${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function fmtDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${day}.${String(month).padStart(2, "0")}`;
}

interface BarChartProps {
  days: { date: string; value: number }[];
  color: string;
  fmtValue?: (v: number) => string;
}

function BarChart({ days, color, fmtValue = fmtDuration }: BarChartProps) {
  const maxVal = Math.max(...days.map((d) => d.value), 1);

  const renderGroup = (group: { date: string; value: number }[]) => (
    <div className="stats-bar-group">
      {group.map((day) => {
        const val = day.value;
        const heightPct = Math.round((val / maxVal) * 100);
        return (
          <div key={day.date} className="stats-bar-col">
            <div className="stats-bar-outer" style={{ backgroundColor: color + '40', borderRadius: '3px 3px 0 0' }}>
              <div
                className="stats-bar-inner"
                style={{ height: `${heightPct}%`, backgroundColor: color }}
              >
                {val > 0 && (
                  <span className="stats-bar-label">{fmtValue(val)}</span>
                )}
              </div>
            </div>
            <div className="stats-bar-date">{fmtDate(day.date)}</div>
          </div>
        );
      })}
    </div>
  );

  const first7 = days.slice(0, 7);
  const second7 = days.slice(7, 14);

  return (
    <div className="stats-bar-chart">
      <div className="stats-bar-rows-mobile">
        {renderGroup(first7)}
        {second7.length > 0 && renderGroup(second7)}
      </div>
      <div className="stats-bar-rows-desktop">
        {renderGroup(days)}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const children = useChildrenStore((s) => s.children);
  const [childId, setChildId] = useState<number | null>(null);
  const [days, setDays] = useState<DayAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formulaDays, setFormulaDays] = useState<FormulaDay[]>([]);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [formulaDateFrom, setFormulaDateFrom] = useState(() => daysAgo(30));
  const [formulaDateTo, setFormulaDateTo] = useState(() => toDateStr(new Date()));

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
        setDays(sorted.slice(0, 14));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [childId, token]);

  useEffect(() => {
    if (childId === null || !token) return;
    setFormulaLoading(true);
    setFormulaError(null);
    authedFetch(
      `/api/analytics/formula?child_id=${childId}&date_from=${formulaDateFrom}&date_to=${formulaDateTo}`
    )
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: FormulaDay[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setFormulaDays(sorted);
      })
      .catch((e) => setFormulaError(e.message))
      .finally(() => setFormulaLoading(false));
  }, [childId, token, formulaDateFrom, formulaDateTo]);

  const sections: { key: keyof DayAnalytics["data"]; label: string; color: string }[] = [
    { key: "cycle_length", label: t("stats.cycleLength"), color: "#6c8ebf" },
    { key: "day_sleep_duration", label: t("stats.daySleep"), color: "#82b366" },
    { key: "night_sleep_duration", label: t("stats.nightSleep"), color: "#4a4a8a" },
    { key: "total_awake_duration", label: t("stats.totalAwake"), color: "#d6a84e" },
  ];

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h2>{t("stats.title")}</h2>
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

      {loading && <p>{t("settings.loading")}</p>}
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

      {formulaLoading && <p>{t("settings.loading")}</p>}
      {formulaError && <p style={{ color: "red" }}>{formulaError}</p>}

      {childId !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setFormulaDateFrom(fd.get("date_from") as string);
            setFormulaDateTo(fd.get("date_to") as string);
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "8px 0" }}
        >
          <label>
            {t("chart.dateFrom")} <input name="date_from" type="date" defaultValue={formulaDateFrom} required />
          </label>
          <label>
            {t("chart.dateTo")} <input name="date_to" type="date" defaultValue={formulaDateTo} required />
          </label>
          <button type="submit">{t("chart.load")}</button>
        </form>
      )}

      {!formulaLoading && formulaDays.length > 0 && (
        <div className="stats-sections">
          <div className="stats-section">
            <h3 className="stats-section-title">{t("stats.formulaVolume")}</h3>
            <BarChart
              days={formulaDays.map((d) => ({ date: d.date, value: d.total_volume }))}
              color="#e07b39"
              fmtValue={(v) => `${v}ml`}
            />
          </div>
          <div className="stats-section">
            <h3 className="stats-section-title">{t("stats.formulaCount")}</h3>
            <BarChart
              days={formulaDays.map((d) => ({ date: d.date, value: d.count }))}
              color="#c45c8a"
              fmtValue={(v) => String(v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
