import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { useChildrenStore } from "../store/children";
import { authedFetch } from "../api/client";
import BarChart from "../components/BarChart";

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

export default function BottlePage() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const children = useChildrenStore((s) => s.children);
  const [childId, setChildId] = useState<number | null>(null);
  const [formulaDays, setFormulaDays] = useState<FormulaDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => daysAgo(30));
  const [dateTo, setDateTo] = useState(() => toDateStr(new Date()));

  useEffect(() => {
    if (children.length > 0 && childId === null) {
      setChildId(children[0].id);
    }
  }, [children, childId]);

  useEffect(() => {
    if (childId === null || !token) return;
    setLoading(true);
    setError(null);
    authedFetch(
      `/api/analytics/formula?child_id=${childId}&date_from=${dateFrom}&date_to=${dateTo}`
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
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [childId, token, dateFrom, dateTo]);

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h2>{t("bottle_title")}</h2>
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

      {childId !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setDateFrom(fd.get("date_from") as string);
            setDateTo(fd.get("date_to") as string);
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "8px 0" }}
        >
          <label>
            {t("chart_dateFrom")} <input name="date_from" type="date" defaultValue={dateFrom} required />
          </label>
          <label>
            {t("chart_dateTo")} <input name="date_to" type="date" defaultValue={dateTo} required />
          </label>
          <button type="submit">{t("chart_load")}</button>
        </form>
      )}

      {loading && <p>{t("settings_loading")}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && formulaDays.length > 0 && (
        <div className="stats-sections">
          <div className="stats-section">
            <h3 className="stats-section-title">{t("stats_formulaVolume")}</h3>
            <BarChart
              days={formulaDays.map((d) => ({ date: d.date, value: d.total_volume }))}
              color="#e07b39"
              fmtValue={(v) => `${v}ml`}
            />
          </div>
          <div className="stats-section">
            <h3 className="stats-section-title">{t("stats_formulaCount")}</h3>
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
