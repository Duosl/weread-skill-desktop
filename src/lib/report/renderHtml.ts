import { formatDuration } from "../format";
import { reportTemplates } from "./templates";
import type { ReadingReportData, ReportTemplateId } from "./types";

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function metric(label: string, value: string | number): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function rankList(items: Array<{ title: string; subtitle: string; value: string }>, limit = 8): string {
  if (items.length === 0) return "";
  return `<div class="rank-list">${items.slice(0, limit).map((item, index) => `
    <div class="rank-row">
      <em>${index + 1}</em>
      <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.subtitle)}</span></div>
      <small>${escapeHtml(item.value)}</small>
    </div>
  `).join("")}</div>`;
}

function excerptList(data: ReadingReportData, limit = 10): string {
  if (data.excerpts.length === 0) return "";
  return `<div class="excerpt-list">${data.excerpts.slice(0, limit).map((item) => `
    <figure>
      <blockquote>${escapeHtml(item.content)}</blockquote>
      <figcaption>${item.kind === "review" ? "想法" : "划线"} · ${escapeHtml(item.bookTitle)}${item.chapter ? ` · ${escapeHtml(item.chapter)}` : ""}</figcaption>
    </figure>
  `).join("")}</div>`;
}

function categoryBars(data: ReadingReportData): string {
  if (data.categories.length === 0) return "";
  const max = Math.max(...data.categories.map((item) => item.readingTime), 1);
  return `<div class="bars">${data.categories.slice(0, 10).map((item) => `
    <div class="bar-row">
      <span>${escapeHtml(item.title)}</span>
      <i><b style="width:${Math.max((item.readingTime / max) * 100, 6)}%"></b></i>
      <small>${escapeHtml(formatDuration(item.readingTime))} · ${item.share}%</small>
    </div>
  `).join("")}</div>`;
}

function insightList(data: ReadingReportData): string {
  if (data.insights.length === 0) return "";
  return `<div class="insights">${data.insights.map((item) => `
    <div><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.summary)}</strong><small>${escapeHtml(item.evidence)}</small></div>
  `).join("")}</div>`;
}

export function reportHtmlTitle(templateId: ReportTemplateId, data: ReadingReportData): string {
  const template = reportTemplates.find((item) => item.id === templateId);
  return `${data.profile.periodLabel}${template?.name ?? "阅读报告"}`;
}

function htmlThemeCss(templateId: ReportTemplateId): string {
  if (templateId === "journey") {
    return `
    body { background: #efe6c9; }
    main { background:
      linear-gradient(90deg, rgba(132,111,82,.07) 1px, transparent 1px),
      linear-gradient(180deg, rgba(132,111,82,.06) 1px, transparent 1px),
      linear-gradient(160deg,#fff9e9 0%,#f9f1d9 48%,#f1f7ef 100%); background-size: 44px 44px,44px 44px,auto; border: 1px solid rgba(132,111,82,.18); }
    h1 { color: #2f2a1f; }
    .cover { display:grid; grid-template-columns: 1fr 144px; gap:24px; }
    .seal { display:grid; place-items:center; min-height:144px; border-radius:999px; border:1px solid rgba(132,111,82,.26); color:#513f24; }
    .seal strong { font-size:46px; font-family: Georgia, serif; font-weight:400; }
    .metric, .insights div, .rank-row, figure { border-radius: 18px 6px 18px 6px; background: rgba(255,253,248,.72); }
    .metric span, .insights span, .rank-row em { color:#1c7f58; }
    .bar-row b { background: linear-gradient(90deg,#2f80ed,#1eb869,#d6a94a); }`;
  }

  if (templateId === "annual") {
    return `
    body { background: #101922; color:#fffdf8; }
    main { background:
      radial-gradient(circle at 18% 18%, rgba(246,231,182,.18), transparent 24%),
      linear-gradient(145deg,#101922 0%,#18323a 52%,#1a252f 100%); border:1px solid rgba(246,231,182,.2); color:#fffdf8; }
    h1 { color:#fffdf8; font-size:64px; }
    .cover { display:grid; grid-template-columns: 1fr 168px; gap:24px; }
    .seal { display:grid; place-items:center; min-height:168px; border-radius:999px; border:1px solid rgba(246,231,182,.32); background:rgba(246,231,182,.08); }
    .seal strong { color:#f6e7b6; font-size:62px; font-family: Georgia, serif; font-weight:400; }
    .metric, .insights div, .rank-row, figure { border:1px solid rgba(246,231,182,.12); border-radius:4px; background:rgba(255,253,248,.1); }
    .metric span, .insights span, .rank-row em { color:#f6e7b6; }
    .cover p, .insights small, .rank-row span, .rank-row small, figcaption, footer, .bar-row small, .bar-row span { color:rgba(255,253,248,.68); }
    .bar-row i { background:rgba(255,253,248,.16); }`;
  }

  return `
    body { background: #eef2f4; }
    main { background:
      linear-gradient(rgba(25,38,51,.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(25,38,51,.045) 1px, transparent 1px),
      radial-gradient(circle at 92% 8%, rgba(30,184,105,.16), transparent 28%),
      linear-gradient(135deg,#fffdf8 0%,#f4f8ff 100%); background-size:36px 36px,36px 36px,auto,auto; border:1px solid rgba(25,38,51,.08); }
    .cover { display:grid; grid-template-columns: 1fr 260px; gap:24px; }
    .seal { border:1px solid rgba(25,38,51,.12); background:rgba(255,255,255,.72); padding:16px; }
    .seal strong { color:#192633; font-size:18px; }
    .metric, .insights div, .rank-row, figure { border:1px solid rgba(25,38,51,.08); border-radius:6px; background:rgba(255,255,255,.78); }
    .metric strong { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }`;
}

export function renderReportHtml(templateId: ReportTemplateId, data: ReadingReportData): string {
  const title = reportHtmlTitle(templateId, data);
  const focus = data.categories.slice(0, 3).map((item) => item.title).join(" / ") || "暂无分类";
  const body = [
    `<header class="cover">
      <div>
        <span>${escapeHtml(data.profile.generatedAt)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(data.insights[0]?.summary ?? `${formatDuration(data.profile.totalReadTime)}，${data.profile.readDays} 个阅读日，${data.profile.noteCount} 条记录。`)}</p>
      </div>
      <aside class="seal">
        <span>${templateId === "journey" ? "READING DAYS" : templateId === "annual" ? "FINISHED" : "FOCUS"}</span>
        <strong>${escapeHtml(templateId === "journey" ? data.profile.readDays : templateId === "annual" ? data.profile.finishedBooks : focus)}</strong>
      </aside>
    </header>`,
    `<section class="metrics">
      ${metric("阅读时长", formatDuration(data.profile.totalReadTime))}
      ${metric("阅读日", `${data.profile.readDays} 天`)}
      ${metric("读完", `${data.profile.finishedBooks} 本`)}
      ${metric("读过", `${data.profile.readBooks} 本`)}
      ${metric("笔记记录", `${data.profile.noteCount} 条`)}
      ${metric("完成率", `${data.profile.completionRate}%`)}
      ${metric("日均阅读", formatDuration(data.profile.averageReadTimePerDay))}
      ${metric("笔记/书", `${data.profile.notesPerBook} 条`)}
    </section>`,
    section("分类偏好", categoryBars(data)),
    section("报告结论", insightList(data)),
    section("阅读节奏", data.timeline.length >= 2 ? `<div class="summary">
      ${metric("峰值", `${data.timelineSummary.peakLabel} · ${formatDuration(data.timelineSummary.peakReadingTime)}`)}
      ${metric("平均", formatDuration(Math.round(data.timelineSummary.averageReadingTime)))}
      ${metric("趋势", data.timelineSummary.trend === "rising" ? "后段增强" : data.timelineSummary.trend === "falling" ? "前段集中" : "相对均衡")}
    </div>` : ""),
    section("笔记密度排行", rankList(data.rankings.noteLeaders)),
    section("投入时长排行", rankList(data.rankings.longReadLeaders)),
    section("想法活跃排行", rankList(data.rankings.reviewLeaders)),
    section("代表性摘录", excerptList(data, 12)),
    `<footer>数据覆盖：${data.sourceSummary.notebookBooks} 本笔记书，${data.sourceSummary.categoryCount} 个分类，${data.sourceSummary.timelinePoints} 个时间节点，${data.sourceSummary.excerptCount} 条代表性摘录。</footer>`,
  ].filter(Boolean).join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color: #192633; background: #f8f7f3; font-family: "Noto Serif SC", "Songti SC", serif; }
    body { margin: 0; padding: 40px; }
    main { max-width: 1120px; margin: 0 auto; border-radius: 24px; padding: 42px; box-shadow: 0 24px 70px rgba(30,24,15,.12); }
    .cover span, footer { color: #756d62; font-size: 13px; }
    h1 { margin: 12px 0; font-size: 58px; line-height: 1.05; font-weight: 500; }
    .cover p { max-width: 760px; color: #5f6b70; font-size: 20px; line-height: 1.8; }
    .seal span, .seal strong { display:block; overflow-wrap:anywhere; }
    .seal span { font-size: 11px; font-weight: 800; letter-spacing: .08em; }
    .seal strong { margin-top: 10px; line-height: 1.25; }
    .metrics, .summary, .insights { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14px; margin: 28px 0; }
    .metric, .insights div, .rank-row, figure { padding: 16px; }
    .metric span, .insights span { display:block; color: #2f80ed; font-size: 13px; font-weight: 700; }
    .metric strong { display:block; margin-top: 10px; font-size: 24px; }
    .section { margin-top: 34px; }
    h2 { font-size: 24px; margin: 0 0 16px; }
    .bars { display:grid; gap: 12px; }
    .bar-row { display:grid; grid-template-columns: 120px 1fr 150px; gap:12px; align-items:center; }
    .bar-row i { height: 9px; border-radius: 99px; background: rgba(132,111,82,.12); overflow:hidden; }
    .bar-row b { display:block; height:100%; border-radius:99px; background: linear-gradient(90deg,#2f80ed,#1eb869); }
    .insights { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .insights strong { display:block; margin-top: 8px; line-height: 1.8; }
    .insights small, .rank-row span, .rank-row small, figcaption, .bar-row span, .bar-row small { color: #756d62; }
    .rank-list { display:grid; gap:10px; }
    .rank-row { display:grid; grid-template-columns: 36px 1fr 110px; gap:12px; align-items:center; }
    .rank-row em { color:#2f80ed; font-style:normal; font-weight:800; }
    blockquote { margin:0; font-size: 17px; line-height: 1.9; }
    figcaption { margin-top: 10px; font-size: 13px; }
    footer { margin-top: 40px; border-top: 1px solid rgba(132,111,82,.14); padding-top: 18px; }
    ${htmlThemeCss(templateId)}
    @media (max-width: 820px) {
      body { padding: 16px; }
      main { padding: 22px; border-radius: 18px; }
      .cover { grid-template-columns: 1fr; }
      h1 { font-size: 38px; }
      .metrics, .summary, .insights { grid-template-columns: 1fr; }
      .bar-row, .rank-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}
