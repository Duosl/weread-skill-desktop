import { useMemo, useState } from "react";
import { formatDuration } from "../../lib/format";

type ChartViewMode = "year" | "month" | "day";

type ChartDataPoint = {
  label: string;
  value: number;
  timestamp: number;
};

type ReadingTimeChartProps = {
  readTimes: Record<string, number>;
  dailyReadTimes: Record<string, number>;
  viewMode: ChartViewMode;
  selectedYear?: number;
  selectedMonth?: number;
  onBarClick: (timestamp: number) => void;
};

function getYearLabel(ts: number): string {
  return new Date(ts * 1000).getFullYear().toString();
}

function getMonthLabel(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getDayLabel(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getShortDayLabel(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getDate()}`;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  let nice: number;
  if (residual <= 1.5) nice = 1.5;
  else if (residual <= 2) nice = 2;
  else if (residual <= 3) nice = 3;
  else if (residual <= 5) nice = 5;
  else if (residual <= 7) nice = 7;
  else nice = 10;
  return nice * magnitude;
}

function formatYAxis(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 1) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const minutes = seconds / 60;
  if (minutes >= 1) return `${Math.round(minutes)}m`;
  return "0";
}

export function ReadingTimeChart({
  readTimes,
  dailyReadTimes,
  viewMode,
  selectedYear,
  selectedMonth,
  onBarClick,
}: ReadingTimeChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { data, maxVal, yTicks } = useMemo(() => {
    const points: ChartDataPoint[] = [];
    let max = 0;

    if (viewMode === "year") {
      const entries = Object.entries(readTimes)
        .map(([k, v]) => ({ timestamp: Number(k), value: Number(v) || 0 }))
        .sort((a, b) => a.timestamp - b.timestamp);
      for (const entry of entries) {
        points.push({ label: getYearLabel(entry.timestamp), ...entry });
        if (entry.value > max) max = entry.value;
      }
    } else if (viewMode === "month" && selectedYear) {
      const entries = Object.entries(readTimes)
        .map(([k, v]) => ({ timestamp: Number(k), value: Number(v) || 0 }))
        .filter((e) => new Date(e.timestamp * 1000).getFullYear() === selectedYear)
        .sort((a, b) => a.timestamp - b.timestamp);
      for (const entry of entries) {
        points.push({ label: getMonthLabel(entry.timestamp), ...entry });
        if (entry.value > max) max = entry.value;
      }
    } else if (viewMode === "day" && selectedYear && selectedMonth !== undefined) {
      const source = Object.keys(dailyReadTimes).length > 0 ? dailyReadTimes : readTimes;
      const valueMap = new Map<number, number>();
      for (const [k, v] of Object.entries(source)) {
        valueMap.set(Number(k), Number(v) || 0);
      }
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const ts = new Date(selectedYear, selectedMonth - 1, day).getTime() / 1000;
        const value = valueMap.get(ts) ?? 0;
        points.push({ label: getShortDayLabel(ts), value, timestamp: ts });
        if (value > max) max = value;
      }
    }

    const ceiling = niceMax(max);
    const ticks: number[] = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(Math.round((ceiling / tickCount) * i));
    }

    return { data: points, maxVal: ceiling || 1, yTicks: ticks };
  }, [readTimes, dailyReadTimes, viewMode, selectedYear, selectedMonth]);

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        <p>暂无阅读时长数据</p>
      </div>
    );
  }

  const showFullLabel = viewMode !== "day";

  const barMinWidth = viewMode === "day" ? 32 : 40;

  return (
    <div className="reading-chart">
      <div className="chart-body">
        <div className="chart-y-axis">
          {yTicks.map((tick) => (
            <span key={tick} className="chart-y-label">
              {formatYAxis(tick)}
            </span>
          ))}
        </div>
        <div className="chart-scroll">
          <div
            className="chart-bars"
            style={{ minWidth: data.length * barMinWidth }}
          >
            {data.map((point, idx) => {
            const heightPct = point.value > 0
              ? Math.max((point.value / maxVal) * 100, 2)
              : 1.2;
            const isZero = point.value === 0;
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={point.timestamp}
                className={`chart-bar-wrapper${isHovered ? " hovered" : ""}`}
                onClick={() => onBarClick(point.timestamp)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {isHovered ? (
                  <div className="chart-tooltip">{formatDuration(point.value)}</div>
                ) : null}
                <div className="chart-bar-track">
                  <div
                    className={`chart-bar-fill${isZero ? " zero" : ""}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="chart-bar-label">
                  {showFullLabel ? point.label : getDayLabel(point.timestamp)}
                </span>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
