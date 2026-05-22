import { BookOpen, Clock, Compass, Library, ListOrdered, PenLine, PieChart, Route, Sparkles, Target, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { formatDuration } from "../format";
import {
  REPORT_DATA_SOURCE_TEXT,
  REPORT_REPOSITORY_LABEL,
  REPORT_REPOSITORY_URL,
  REPORT_SOURCE_ACTION,
  REPORT_SOURCE_TEXT,
  REPORT_SOURCE_TITLE,
} from "./source";
import type { ReadingReportData, ReportRankItem, ReportTemplateId } from "./types";

type ReportTemplateProps = {
  data: ReadingReportData;
};

export const reportTemplates: Array<{
  id: ReportTemplateId;
  name: string;
  tagline: string;
  description: string;
}> = [
  {
    id: "analysis",
    name: "阅读分析报告",
    tagline: "数据剖面",
    description: "用阅读时长、分类和笔记密度整理一份结构化分析。",
  },
  {
    id: "journey",
    name: "读书旅程",
    tagline: "时间路径",
    description: "按阅读路径、重点书籍和阶段信号呈现你的阅读轨迹。",
  },
  {
    id: "annual",
    name: "年度阅读报告",
    tagline: "总结封面",
    description: "用更强的视觉总结阅读数字、偏好和代表性记录。",
  },
];

export function ReportTemplate({ id, data }: { id: ReportTemplateId; data: ReadingReportData }) {
  if (id === "journey") return <JourneyReportTemplate data={data} />;
  if (id === "annual") return <AnnualReportTemplate data={data} />;
  return <AnalysisReportTemplate data={data} />;
}

function ReportMetric({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="report-metric">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function CategoryBars({ data }: ReportTemplateProps) {
  if (data.categories.length === 0) return null;
  const max = Math.max(...data.categories.map((item) => item.readingTime), 1);
  return (
    <div className="report-bars">
      {data.categories.slice(0, 8).map((item) => (
        <div className="report-bar-row" key={item.title}>
          <span>{item.title}</span>
          <div>
            <i style={{ width: `${Math.max((item.readingTime / max) * 100, 6)}%` }} />
          </div>
          <small>{formatDuration(item.readingTime)} · {item.share}%</small>
        </div>
      ))}
    </div>
  );
}

function TopBooks({ data, limit = 8 }: ReportTemplateProps & { limit?: number }) {
  if (data.books.length === 0) return null;
  return (
    <div className="report-book-list">
      {data.books.slice(0, limit).map((book, index) => (
        <div className="report-book-row" key={book.bookId}>
          <em>{String(index + 1).padStart(2, "0")}</em>
          <div>
            <strong>{book.title}</strong>
            <span>{book.author || "未知作者"} · {book.totalNotes} 条记录</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightList({ data }: ReportTemplateProps) {
  if (data.insights.length === 0) return null;
  return (
    <div className="report-insight-list">
      {data.insights.map((item) => (
        <div key={item.title}>
          <span>{item.title}</span>
          <strong>{item.summary}</strong>
          <small>{item.evidence}</small>
        </div>
      ))}
    </div>
  );
}

function RankList({ items, limit = 6 }: { items: ReportRankItem[]; limit?: number }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((item) => item.score), 1);
  return (
    <div className="report-rank-list">
      {items.slice(0, limit).map((item, index) => (
        <div key={`${item.title}-${index}`} className="report-rank-row">
          <em>{index + 1}</em>
          <div>
            <strong>{item.title}</strong>
            <span>{item.subtitle}</span>
            <i>
              <b style={{ width: `${Math.max((item.score / max) * 100, 8)}%` }} />
            </i>
          </div>
          <small>{item.value}</small>
        </div>
      ))}
    </div>
  );
}

function TimelinePanel({ data }: ReportTemplateProps) {
  if (data.timeline.length < 2) return null;
  return (
    <div className="report-timeline-panel">
      <div className="report-section-title">
        <TrendingUp size={18} />
        <h3>阅读节奏</h3>
      </div>
      <div className="report-timeline-summary">
        <div>
          <span>峰值</span>
          <strong>{data.timelineSummary.peakLabel || "-"}</strong>
          <small>{formatDuration(data.timelineSummary.peakReadingTime)}</small>
        </div>
        <div>
          <span>平均</span>
          <strong>{formatDuration(Math.round(data.timelineSummary.averageReadingTime))}</strong>
          <small>{data.timelineSummary.activePoints} 个有记录节点</small>
        </div>
        <div>
          <span>趋势</span>
          <strong>
            {data.timelineSummary.trend === "rising"
              ? "后段增强"
              : data.timelineSummary.trend === "falling"
                ? "前段集中"
                : data.timelineSummary.trend === "flat"
                  ? "相对均衡"
                  : "样本较少"}
          </strong>
          <small>{data.timelineSummary.totalPoints} 个时间节点</small>
        </div>
      </div>
      <div className="journey-line expanded">
        {data.timeline.slice(-10).map((item) => (
          <div key={`${item.timestamp}-${item.label}`}>
            <span>{item.label}</span>
            <strong>{formatDuration(item.readingTime)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcePanel({ }: ReportTemplateProps) {
  return (
    <div className="report-source-panel">
      <div className="report-source-copy">
        <span>{REPORT_DATA_SOURCE_TEXT}</span>
        <strong>{REPORT_SOURCE_TITLE}</strong>
        <small>{REPORT_SOURCE_TEXT}</small>
      </div>
      <a className="report-source-link" href={REPORT_REPOSITORY_URL} target="_blank" rel="noreferrer">
        <b>{REPORT_SOURCE_ACTION}</b>
        <small>{REPORT_REPOSITORY_LABEL}</small>
      </a>
    </div>
  );
}

function NoteSignalPanel({ data }: ReportTemplateProps) {
  return (
    <div className="report-highlight-list">
      <div>
        <span>划线密度</span>
        <strong>{data.profile.bookmarkCount} 条划线</strong>
        <small>用于衡量阅读过程中留下痕迹的频率，不展示原文。</small>
      </div>
      <div>
        <span>想法密度</span>
        <strong>{data.profile.reviewCount} 条想法</strong>
        <small>用于衡量主动表达和复盘强度，不展示个人想法内容。</small>
      </div>
      <div>
        <span>样本覆盖</span>
        <strong>{data.sourceSummary.sampledBooks} 本重点书</strong>
        <small>报告基于统计摘要和书籍维度生成，避免在基础模板铺开原始笔记。</small>
      </div>
    </div>
  );
}

function ReportManifest({ data }: ReportTemplateProps) {
  const focus = data.categories.slice(0, 3).map((item) => item.title).join(" / ") || "暂无分类";
  return (
    <div className="report-manifest">
      <div>
        <span>Focus</span>
        <strong>{focus}</strong>
      </div>
      <div>
        <span>Trace</span>
        <strong>{data.profile.noteCount} 条记录</strong>
      </div>
      <div>
        <span>Range</span>
        <strong>{data.profile.periodLabel || "全部"}</strong>
      </div>
    </div>
  );
}

function AnalysisReportTemplate({ data }: ReportTemplateProps) {
  return (
    <article className="report-surface analysis-report">
      <header className="report-cover">
        <div>
          <span className="report-kicker">Reading Analysis</span>
          <h2>{data.profile.periodLabel}阅读分析报告</h2>
          <p>{data.insights[0]?.summary ?? "从阅读时长、分类分布和笔记密度中整理出的个人阅读剖面。"}</p>
        </div>
        <ReportManifest data={data} />
      </header>

      <section className="report-metrics-grid">
        <ReportMetric icon={<Clock size={18} />} label="阅读时长" value={formatDuration(data.profile.totalReadTime)} />
        <ReportMetric icon={<BookOpen size={18} />} label="读完" value={`${data.profile.finishedBooks} 本`} />
        <ReportMetric icon={<PenLine size={18} />} label="笔记记录" value={`${data.profile.noteCount} 条`} />
        <ReportMetric icon={<Library size={18} />} label="有记录的书" value={`${data.books.length} 本`} />
        <ReportMetric icon={<Target size={18} />} label="完成率" value={`${data.profile.completionRate}%`} />
        <ReportMetric icon={<Clock size={18} />} label="日均阅读" value={formatDuration(data.profile.averageReadTimePerDay)} />
        <ReportMetric icon={<PenLine size={18} />} label="笔记/书" value={`${data.profile.notesPerBook} 条`} />
        <ReportMetric icon={<BookOpen size={18} />} label="读过" value={`${data.profile.readBooks} 本`} />
      </section>

      <section className="report-flow-sections">
        {data.categories.length > 0 ? <div>
          <div className="report-section-title">
            <PieChart size={18} />
            <h3>分类偏好</h3>
          </div>
          <CategoryBars data={data} />
        </div> : null}
        {data.highlights.length > 0 ? <div>
          <div className="report-section-title">
            <Sparkles size={18} />
            <h3>本期信号</h3>
          </div>
          <div className="report-highlight-list">
            {data.highlights.map((item) => (
              <div key={item.title}>
                <span>{item.title}</span>
                <strong>{item.description}</strong>
                <small>{item.metric}</small>
              </div>
            ))}
          </div>
        </div> : null}
      </section>

      <TimelinePanel data={data} />

      <section className="report-deep-section">
        <div className="report-section-title">
          <Sparkles size={18} />
          <h3>规则化结论</h3>
        </div>
        <InsightList data={data} />
      </section>

      <section className="report-deep-section report-flow-sections report-rank-stack">
        {data.rankings.noteLeaders.length > 0 ? <div>
          <div className="report-section-title">
            <ListOrdered size={18} />
            <h3>笔记密度排行</h3>
          </div>
          <RankList items={data.rankings.noteLeaders} limit={6} />
        </div> : null}
        {data.rankings.longReadLeaders.length > 0 ? <div>
          <div className="report-section-title">
            <Clock size={18} />
            <h3>投入时长排行</h3>
          </div>
          <RankList items={data.rankings.longReadLeaders} limit={6} />
        </div> : null}
        {data.rankings.reviewLeaders.length > 0 ? <div>
          <div className="report-section-title">
            <PenLine size={18} />
            <h3>想法活跃排行</h3>
          </div>
          <RankList items={data.rankings.reviewLeaders} limit={6} />
        </div> : null}
      </section>

      <section className="report-deep-section">
        <div className="report-section-title">
          <PenLine size={18} />
          <h3>笔记信号</h3>
        </div>
        <NoteSignalPanel data={data} />
      </section>

      <SourcePanel data={data} />
    </article>
  );
}

function JourneyReportTemplate({ data }: ReportTemplateProps) {
  return (
    <article className="report-surface journey-report">
      <header className="report-cover compact">
        <div>
          <span className="report-kicker">Reading Journey</span>
          <h2>读书旅程</h2>
          <p>{data.insights.find((item) => item.title === "节奏变化")?.summary ?? "把阅读记录整理成一条路径：哪些方向持续出现，哪些书留下了更多笔记。"}</p>
        </div>
        <div className="journey-stamp">
          <span>{data.profile.periodLabel}</span>
          <strong>{data.profile.readDays}</strong>
          <small>阅读日</small>
        </div>
      </header>

      {data.timeline.length >= 2 ? <section className="journey-line">
        {data.timeline.slice(-10).map((item) => (
          <div key={`${item.timestamp}-${item.label}`}>
            <span>{item.label}</span>
            <strong>{formatDuration(item.readingTime)}</strong>
          </div>
        ))}
      </section> : null}

      <section className="report-flow-sections">
        {data.books.length > 0 ? <div>
          <div className="report-section-title">
            <Route size={18} />
            <h3>路径上的书</h3>
          </div>
          <TopBooks data={data} limit={10} />
        </div> : null}
        {data.categories.length > 0 ? <div>
          <div className="report-section-title">
            <Compass size={18} />
            <h3>方向感</h3>
          </div>
          <div className="journey-categories">
            {data.categories.slice(0, 10).map((item) => (
              <span key={item.title}>{item.title} · {item.share}%</span>
            ))}
          </div>
        </div> : null}
      </section>

      <section className="journey-reflection report-flow-sections">
        {data.insights.length > 0 ? <div>
          <div className="report-section-title">
            <Sparkles size={18} />
            <h3>旅程注脚</h3>
          </div>
          <InsightList data={data} />
        </div> : null}
        <div>
          <div className="report-section-title">
            <PenLine size={18} />
            <h3>笔记信号</h3>
          </div>
          <NoteSignalPanel data={data} />
        </div>
      </section>

      <section className="report-deep-section report-flow-sections report-rank-stack">
        {data.rankings.bookmarkLeaders.length > 0 ? <div>
          <div className="report-section-title">
            <PenLine size={18} />
            <h3>划线最多</h3>
          </div>
          <RankList items={data.rankings.bookmarkLeaders} />
        </div> : null}
        {data.rankings.reviewLeaders.length > 0 ? <div>
          <div className="report-section-title">
            <Sparkles size={18} />
            <h3>想法最多</h3>
          </div>
          <RankList items={data.rankings.reviewLeaders} />
        </div> : null}
        {data.rankings.progressLeaders.length > 0 ? <div>
          <div className="report-section-title">
            <Target size={18} />
            <h3>进度靠前</h3>
          </div>
          <RankList items={data.rankings.progressLeaders} />
        </div> : null}
      </section>

      <SourcePanel data={data} />
    </article>
  );
}

function AnnualReportTemplate({ data }: ReportTemplateProps) {
  return (
    <article className="report-surface annual-report">
      <header className="annual-hero">
        <div>
          <span>{data.profile.generatedAt}</span>
          <h2>{data.profile.periodLabel}阅读报告</h2>
          <p>{formatDuration(data.profile.totalReadTime)}，{data.profile.readDays} 个阅读日，{data.profile.noteCount} 条记录。</p>
        </div>
        <div className="annual-seal">
          <strong>{data.profile.finishedBooks}</strong>
          <span>Finished</span>
        </div>
      </header>

      <section className="annual-number-wall">
        <div>
          <strong>{data.profile.readDays}</strong>
          <span>阅读日</span>
        </div>
        <div>
          <strong>{data.profile.finishedBooks}</strong>
          <span>读完书</span>
        </div>
        <div>
          <strong>{data.profile.bookmarkCount}</strong>
          <span>划线</span>
        </div>
        <div>
          <strong>{data.profile.reviewCount}</strong>
          <span>想法</span>
        </div>
        <div>
          <strong>{data.profile.completionRate}%</strong>
          <span>完成率</span>
        </div>
        <div>
          <strong>{data.profile.notesPerBook}</strong>
          <span>笔记/书</span>
        </div>
      </section>

      <section className="annual-focus report-flow-sections">
        {data.categories.length > 0 ? <div>
          <h3>年度关键词</h3>
          <div className="journey-categories">
            {data.categories.slice(0, 10).map((item) => (
              <span key={item.title}>{item.title} · {item.share}%</span>
            ))}
          </div>
        </div> : null}
        {data.books.length > 0 ? <div>
          <h3>最有痕迹的书</h3>
          <TopBooks data={data} limit={8} />
        </div> : null}
      </section>

      {data.insights.length > 0 ? <section className="annual-quote-strip">
        <h3>年度注脚</h3>
        <InsightList data={data} />
      </section> : null}

      <section className="annual-quote-strip">
        <h3>笔记信号</h3>
        <div className="annual-note-signal">
          <NoteSignalPanel data={data} />
        </div>
      </section>

      <section className="annual-focus report-flow-sections report-rank-stack">
        {data.rankings.longReadLeaders.length > 0 ? <div>
          <h3>最长陪伴</h3>
          <RankList items={data.rankings.longReadLeaders} limit={6} />
        </div> : null}
        {data.rankings.noteLeaders.length > 0 ? <div>
          <h3>最多痕迹</h3>
          <RankList items={data.rankings.noteLeaders} limit={6} />
        </div> : null}
      </section>

      <SourcePanel data={data} />
    </article>
  );
}
