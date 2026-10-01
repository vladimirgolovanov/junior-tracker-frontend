// Shared bar chart used by the Sleep and Bottle stats pages. Renders up to 14 days
// as two rows of 7 on narrow screens and a single row on wide ones (CSS-driven).
import i18n from "../i18n";

function fmtDuration(minutes: number): string {
  // Unit labels from i18n; the pages rendering this chart use useTranslation(), so a
  // language change re-renders them and re-runs this with the current language.
  const h = i18n.t("common_hoursShort");
  const m = i18n.t("common_minutesShort");
  if (!minutes) return `0${m}`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs && mins) return `${hrs}${h}\n${mins}${m}`;
  if (hrs) return `${hrs}${h}`;
  return `${mins}${m}`;
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

export default function BarChart({ days, color, fmtValue = fmtDuration }: BarChartProps) {
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
