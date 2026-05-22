import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BookOpen,
  Calendar,
  Clock,
  Heart,
  Library,
  PenLine,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { ReadingTimeChart } from "../components/stats/ReadingTimeChart";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { Spinner } from "../components/ui/Spinner";
import { notifyWereadDataRefreshed } from "../lib/dataRefreshEvents";
import { formatDuration } from "../lib/format";
import type { ReadingMode } from "../hooks/useReadingStats";
import type { ReadingStatsResult } from "../types";

type ChartViewMode = "year" | "month" | "day";

type OverviewPageProps = {
  apiKeySet: boolean;
  shelf: {
    rawBooks: unknown[];
    loading: boolean;
    syncShelf: (forceRefresh?: boolean) => Promise<unknown>;
  };
  reading: {
    stats: ReadingStatsResult | null;
    loading: boolean;
    error: string | null;
    loadStats: (mode?: ReadingMode, baseTime?: number, forceRefresh?: boolean) => Promise<ReadingStatsResult>;
  };
  notebooks: {
    books: unknown[];
    loadNotebooks: (forceRefresh?: boolean) => Promise<unknown>;
  };
};

function formatHoursMinutes(seconds: number): string {
  if (seconds <= 0) return "0小时0分钟";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}小时${minutes}分钟`;
}

function formatDateFromTs(ts: number): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysBetween(ts: number): number {
  if (!ts) return 0;
  const start = new Date(ts * 1000);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function extractCount(counts: string): number {
  const match = counts.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function OverviewPage({ apiKeySet, shelf, reading, notebooks }: OverviewPageProps) {
  const [chartView, setChartView] = useState<ChartViewMode>("year");
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [chartStats, setChartStats] = useState<ReadingStatsResult | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [showAllLongest, setShowAllLongest] = useState(false);

  useEffect(() => {
    if (apiKeySet) {
      if (shelf.rawBooks.length === 0) void shelf.syncShelf();
      if (!reading.stats) void reading.loadStats("overall");
      if (notebooks.books.length === 0) void notebooks.loadNotebooks();
    }
  }, [apiKeySet]);

  const loadChartStats = useCallback(
    async (mode: ReadingMode, baseTime = 0) => {
      setChartLoading(true);
      try {
        const result = await invoke<ReadingStatsResult>("get_reading_stats", {
          mode,
          baseTime,
          forceRefresh: false,
        });
        setChartStats(result);
        return result;
      } catch {
        return null;
      } finally {
        setChartLoading(false);
      }
    },
    [],
  );

  async function refreshOverviewData() {
    await Promise.all([
      shelf.syncShelf(true),
      reading.loadStats("overall", 0, true),
      notebooks.loadNotebooks(true),
    ]);
    notifyWereadDataRefreshed();
  }

  useEffect(() => {
    if (!apiKeySet) return;
    if (chartView === "year") {
      void loadChartStats("overall");
    } else if (chartView === "month" && selectedYear) {
      const janFirst = new Date(selectedYear, 0, 1).getTime() / 1000;
      void loadChartStats("annually", janFirst);
    } else if (chartView === "day" && selectedYear && selectedMonth) {
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1).getTime() / 1000;
      void loadChartStats("monthly", monthStart);
    }
  }, [chartView, selectedYear, selectedMonth, apiKeySet, loadChartStats]);

  const handleBarClick = useCallback(
    (timestamp: number) => {
      const d = new Date(timestamp * 1000);
      if (chartView === "year") {
        setSelectedYear(d.getFullYear());
        setChartView("month");
        setSelectedMonth(undefined);
      } else if (chartView === "month") {
        setSelectedMonth(d.getMonth() + 1);
        setChartView("day");
      }
    },
    [chartView],
  );

  const handleBreadcrumbClick = useCallback((target: "year" | "month" | "day") => {
    if (target === "year") {
      setChartView("year");
      setSelectedYear(undefined);
      setSelectedMonth(undefined);
    } else if (target === "month") {
      setChartView("month");
      setSelectedMonth(undefined);
    }
  }, []);

  const overallStats = reading.stats;
  const displayStats = chartStats ?? overallStats;

  const longestList = useMemo(() => {
    const items = overallStats?.readLongest ?? [];
    return showAllLongest ? items.slice(0, 10) : items.slice(0, 5);
  }, [overallStats, showAllLongest]);

  const hasMoreLongest = (overallStats?.readLongest?.length ?? 0) > 5;

  const readStatMap = useMemo(() => {
    const map: Record<string, { counts: string; value: number }> = {};
    for (const item of overallStats?.readStat ?? []) {
      map[item.stat] = { counts: item.counts, value: extractCount(item.counts) };
    }
    return map;
  }, [overallStats]);

  const readCount = readStatMap["读过"]?.value ?? 0;
  const finishedCount = readStatMap["读完"]?.value ?? 0;
  const noteCount = readStatMap["笔记"]?.value ?? 0;
  const readDays = overallStats?.readDays ?? 0;
  const totalReadTime = overallStats?.totalReadTime ?? 0;
  const registTime = overallStats?.registTime ?? 0;
  const daysWithWeRead = daysBetween(registTime);

  const chartReadTimes = useMemo(() => {
    const raw = displayStats?.readTimes ?? {};
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      result[k] = typeof v === "number" ? v : Number(v) || 0;
    }
    return result;
  }, [displayStats]);

  const chartDailyReadTimes = useMemo(() => {
    const raw = displayStats?.dailyReadTimes ?? {};
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      result[k] = typeof v === "number" ? v : Number(v) || 0;
    }
    return result;
  }, [displayStats]);

  if (!apiKeySet) {
    return (
      <PageShell title="概览">
        <EmptyState
          title="先配置 API Key"
          description="完成连接后可以查看阅读统计概览。"
          action={
            <Link to="/settings">
              <Button variant="primary">去设置</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="概览"
      action={
        <Button
          variant="primary"
          icon={<RefreshCw size={16} />}
          disabled={reading.loading || shelf.loading}
          onClick={() => void refreshOverviewData()}
        >
          刷新
        </Button>
      }
    >
      <ErrorBanner message={reading.error} />

      {reading.loading && !overallStats ? (
        <Card>
          <Spinner label="正在加载阅读统计" />
        </Card>
      ) : overallStats ? (
        <>
          <div className="overview-hero">
            <div className="overview-hero-main">
              <span className="overview-hero-label">阅读总时长</span>
              <strong className="overview-hero-value">{formatHoursMinutes(totalReadTime)}</strong>
              {registTime > 0 ? (
                <span className="overview-hero-sub">
                  {formatDateFromTs(registTime)}至今，与微信读书相伴 <em>{daysWithWeRead}</em> 天
                </span>
              ) : null}
            </div>
          </div>

          <div className="overview-stats-grid">
            <Card className="overview-stat-card">
              <div className="overview-stat-icon">
                <Library size={20} />
              </div>
              <div className="overview-stat-body">
                <span className="overview-stat-label">读过</span>
                <strong className="overview-stat-value">{readCount}<small>本</small></strong>
              </div>
            </Card>
            <Card className="overview-stat-card">
              <div className="overview-stat-icon finished">
                <BookOpen size={20} />
              </div>
              <div className="overview-stat-body">
                <span className="overview-stat-label">读完</span>
                <strong className="overview-stat-value">{finishedCount}<small>本</small></strong>
              </div>
            </Card>
            <Card className="overview-stat-card">
              <div className="overview-stat-icon days">
                <Calendar size={20} />
              </div>
              <div className="overview-stat-body">
                <span className="overview-stat-label">阅读</span>
                <strong className="overview-stat-value">{readDays}<small>天</small></strong>
              </div>
            </Card>
            <Card className="overview-stat-card">
              <div className="overview-stat-icon notes">
                <PenLine size={20} />
              </div>
              <div className="overview-stat-body">
                <span className="overview-stat-label">笔记</span>
                <strong className="overview-stat-value">{noteCount}<small>条</small></strong>
              </div>
            </Card>
          </div>

          <Card className="overview-chart-card">
            <div className="overview-chart-header">
              <div className="overview-chart-title">
                <Clock size={18} />
                <div>
                  <h2>阅读时长</h2>
                  {chartView !== "day" ? (
                    <p className="chart-hint">
                      {chartView === "year"
                        ? "点击柱状图可查看某年月度详情"
                        : "点击柱状图可查看某月每日详情"}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="overview-chart-breadcrumb">
                <button
                  className={chartView === "year" ? "active" : ""}
                  onClick={() => handleBreadcrumbClick("year")}
                >
                  年
                </button>
                {selectedYear ? (
                  <>
                    <span className="breadcrumb-sep">/</span>
                    <button
                      className={chartView === "month" ? "active" : ""}
                      onClick={() => handleBreadcrumbClick("month")}
                    >
                      {selectedYear}年
                    </button>
                  </>
                ) : null}
                {selectedMonth ? (
                  <>
                    <span className="breadcrumb-sep">/</span>
                    <button className={chartView === "day" ? "active" : ""}>
                      {selectedMonth}月
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            {chartLoading ? (
              <div className="chart-loading">
                <Spinner label="加载图表数据" />
              </div>
            ) : (
              <ReadingTimeChart
                readTimes={chartReadTimes}
                dailyReadTimes={chartDailyReadTimes}
                viewMode={chartView}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                onBarClick={handleBarClick}
              />
            )}
          </Card>

          {overallStats.preferCategory?.length > 0 ? (
            <Card className="overview-preference-card">
              <div className="section-title">
                <Heart size={20} />
                <div>
                  <h2>阅读偏好</h2>
                  <p>按阅读时长排序的分类倾向</p>
                </div>
              </div>
              <div className="preference-list">
                {overallStats.preferCategory.slice(0, 5).map((item) => (
                  <div key={item.categoryTitle}>
                    <span>{item.categoryTitle}</span>
                    <strong>{formatDuration(item.readingTime)}</strong>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {overallStats.readLongest?.length > 0 ? (
            <Card className="overview-longest-card">
              <div className="section-title">
                <TrendingUp size={20} />
                <div>
                  <h2>读得最多</h2>
                  <p>阅读时长最长的书籍</p>
                </div>
              </div>
              <div className="longest-list">
                {longestList.map((item, idx) => (
                  <div key={idx} className="longest-item">
                    <div className="longest-rank">{idx + 1}</div>
                    <div className="longest-info">
                      <strong>{item.book?.title ?? "未知书名"}</strong>
                      <span>{item.book?.author ?? "未知作者"}</span>
                    </div>
                    <div className="longest-time">{formatDuration(item.readTime)}</div>
                  </div>
                ))}
              </div>
              {hasMoreLongest ? (
                <button
                  className="longest-toggle"
                  onClick={() => setShowAllLongest((v) => !v)}
                >
                  {showAllLongest ? "收起" : "查看 Top 10"}
                </button>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
