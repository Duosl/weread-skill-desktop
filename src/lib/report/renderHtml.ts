import { formatDuration } from "../format";
import { reportTemplates } from "./templates";
import type { ReadingReportData, ReportRankItem, ReportTemplateId } from "./types";

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

function section(title: string, body: string, className = ""): string {
  if (!body.trim()) return "";
  const classAttr = className ? ` ${className}` : "";
  return `<section class="section${classAttr}"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function rankList(items: ReportRankItem[], limit = 8): string {
  if (items.length === 0) return "";
  const max = Math.max(...items.map((item) => item.score), 1);
  return `<div class="rank-list">${items.slice(0, limit).map((item, index) => `
    <div class="rank-row">
      <em>${String(index + 1).padStart(2, "0")}</em>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.subtitle)}</span>
        <i><b style="width:${Math.max((item.score / max) * 100, 8)}%"></b></i>
      </div>
      <small>${escapeHtml(item.value)}</small>
    </div>
  `).join("")}</div>`;
}

function categoryBars(data: ReadingReportData, limit = 10): string {
  if (data.categories.length === 0) return "";
  const max = Math.max(...data.categories.map((item) => item.readingTime), 1);
  return `<div class="bars">${data.categories.slice(0, limit).map((item) => `
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
    <div>
      <span>${escapeHtml(item.title)}</span>
      <strong>${escapeHtml(item.summary)}</strong>
      <small>${escapeHtml(item.evidence)}</small>
    </div>
  `).join("")}</div>`;
}

function topBooks(data: ReadingReportData, limit = 8): string {
  if (data.books.length === 0) return "";
  return `<div class="book-list">${data.books.slice(0, limit).map((book, index) => `
    <div class="book-row">
      <em>${String(index + 1).padStart(2, "0")}</em>
      <div>
        <strong>${escapeHtml(book.title)}</strong>
        <span>${escapeHtml(book.author || "未知作者")} · ${book.totalNotes} 条记录</span>
      </div>
    </div>
  `).join("")}</div>`;
}

function timelineStrip(data: ReadingReportData): string {
  if (data.timeline.length < 2) return "";
  return `<div class="timeline-strip">${data.timeline.slice(-10).map((item) => `
    <div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(formatDuration(item.readingTime))}</strong></div>
  `).join("")}</div>`;
}

function sourceFooter(_data: ReadingReportData): string {
  return `<footer>
    <strong>WeRead Skill Desktop</strong>
    <span>数据来源：微信读书 Skill</span>
  </footer>`;
}

function noteSignals(data: ReadingReportData): string {
  return `<div class="note-signals">
    ${metric("划线密度", `${data.profile.bookmarkCount} 条`)}
    ${metric("想法密度", `${data.profile.reviewCount} 条`)}
    ${metric("样本覆盖", `${data.sourceSummary.sampledBooks} 本重点书`)}
    ${metric("笔记/书", `${data.profile.notesPerBook} 条`)}
  </div>
  <p class="section-note">这里展示的是笔记行为的统计信号，不展示原划线和个人想法内容；原文留给笔记浏览、Markdown 导出和授权后的智能体报告使用。</p>`;
}

export function reportHtmlTitle(templateId: ReportTemplateId, data: ReadingReportData): string {
  const template = reportTemplates.find((item) => item.id === templateId);
  return `${data.profile.periodLabel}${template?.name ?? "阅读报告"}`;
}

function analysisBody(data: ReadingReportData, title: string): string {
  const focus = data.categories.slice(0, 3).map((item) => item.title).join(" / ") || "暂无分类";
  return [
    `<header class="cover analysis-cover">
      <div>
        <span>${escapeHtml(data.profile.generatedAt)} · Reading Analysis</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(data.insights[0]?.summary ?? "从阅读时长、分类分布和笔记密度中整理出的个人阅读剖面。")}</p>
      </div>
      <aside class="manifest">
        <div><span>Focus</span><strong>${escapeHtml(focus)}</strong></div>
        <div><span>Trace</span><strong>${data.profile.noteCount} 条记录</strong></div>
        <div><span>Range</span><strong>${escapeHtml(data.profile.periodLabel)}</strong></div>
      </aside>
    </header>`,
    `<section class="metrics">
      ${metric("阅读时长", formatDuration(data.profile.totalReadTime))}
      ${metric("读完", `${data.profile.finishedBooks} 本`)}
      ${metric("笔记记录", `${data.profile.noteCount} 条`)}
      ${metric("完成率", `${data.profile.completionRate}%`)}
      ${metric("日均阅读", formatDuration(data.profile.averageReadTimePerDay))}
      ${metric("笔记/书", `${data.profile.notesPerBook} 条`)}
      ${metric("读过", `${data.profile.readBooks} 本`)}
      ${metric("阅读日", `${data.profile.readDays} 天`)}
    </section>`,
    `<section class="split">
      ${section("分类偏好", categoryBars(data, 8))}
      ${section("规则化结论", insightList(data))}
    </section>`,
    section("阅读节奏", `<div class="summary">
      ${metric("峰值", `${data.timelineSummary.peakLabel || "-"} · ${formatDuration(data.timelineSummary.peakReadingTime)}`)}
      ${metric("平均", formatDuration(Math.round(data.timelineSummary.averageReadingTime)))}
      ${metric("趋势", data.timelineSummary.trend === "rising" ? "后段增强" : data.timelineSummary.trend === "falling" ? "前段集中" : "相对均衡")}
    </div>`),
    `<section class="three">
      ${section("笔记密度排行", rankList(data.rankings.noteLeaders, 6))}
      ${section("投入时长排行", rankList(data.rankings.longReadLeaders, 6))}
      ${section("想法活跃排行", rankList(data.rankings.reviewLeaders, 6))}
    </section>`,
    section("笔记信号", noteSignals(data), "wide"),
    sourceFooter(data),
  ].filter(Boolean).join("\n");
}

function journeyBody(data: ReadingReportData, title: string): string {
  return [
    `<header class="cover journey-cover">
      <div>
        <span>${escapeHtml(data.profile.generatedAt)} · Reading Journey</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(data.insights.find((item) => item.title === "节奏变化")?.summary ?? "把阅读记录整理成一条路径：哪些方向持续出现，哪些书留下了更多笔记。")}</p>
      </div>
      <aside class="seal round">
        <span>${escapeHtml(data.profile.periodLabel)}</span>
        <strong>${data.profile.readDays}</strong>
        <small>阅读日</small>
      </aside>
    </header>`,
    timelineStrip(data),
    `<section class="split">
      ${section("路径上的书", topBooks(data, 10))}
      ${section("方向感", `<div class="tag-cloud">${data.categories.slice(0, 10).map((item) => `<span>${escapeHtml(item.title)} · ${item.share}%</span>`).join("")}</div>`)}
    </section>`,
    `<section class="split reflection">
      ${section("旅程注脚", insightList(data))}
      ${section("笔记信号", noteSignals(data))}
    </section>`,
    `<section class="three">
      ${section("划线最多", rankList(data.rankings.bookmarkLeaders, 6))}
      ${section("想法最多", rankList(data.rankings.reviewLeaders, 6))}
      ${section("进度靠前", rankList(data.rankings.progressLeaders, 6))}
    </section>`,
    sourceFooter(data),
  ].filter(Boolean).join("\n");
}

function annualBody(data: ReadingReportData, title: string): string {
  return [
    `<header class="cover annual-cover">
      <div>
        <span>${escapeHtml(data.profile.generatedAt)} · Annual Ledger</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${formatDuration(data.profile.totalReadTime)}，${data.profile.readDays} 个阅读日，${data.profile.noteCount} 条记录。</p>
      </div>
      <aside class="seal annual-seal">
        <strong>${data.profile.finishedBooks}</strong>
        <span>Finished</span>
      </aside>
    </header>`,
    `<section class="number-wall">
      ${metric("阅读日", data.profile.readDays)}
      ${metric("读完书", data.profile.finishedBooks)}
      ${metric("划线", data.profile.bookmarkCount)}
      ${metric("想法", data.profile.reviewCount)}
      ${metric("完成率", `${data.profile.completionRate}%`)}
      ${metric("笔记/书", data.profile.notesPerBook)}
    </section>`,
    `<section class="split annual-focus">
      ${section("年度关键词", `<div class="tag-cloud">${data.categories.slice(0, 10).map((item) => `<span>${escapeHtml(item.title)} · ${item.share}%</span>`).join("")}</div>`)}
      ${section("最有痕迹的书", topBooks(data, 8))}
    </section>`,
    section("年度注脚", insightList(data), "annual-strip"),
    section("笔记信号", noteSignals(data), "annual-strip"),
    `<section class="split annual-focus">
      ${section("最长陪伴", rankList(data.rankings.longReadLeaders, 6))}
      ${section("最多痕迹", rankList(data.rankings.noteLeaders, 6))}
    </section>`,
    sourceFooter(data),
  ].filter(Boolean).join("\n");
}

function bodyForTemplate(templateId: ReportTemplateId, data: ReadingReportData, title: string): string {
  if (templateId === "journey") return journeyBody(data, title);
  if (templateId === "annual") return annualBody(data, title);
  return analysisBody(data, title);
}

function htmlCss(templateId: ReportTemplateId): string {
  const theme =
    templateId === "journey"
      ? `
    body { background:#efe6c9; color:#2f2a1f; }
    main { background:
      linear-gradient(90deg, rgba(132,111,82,.07) 1px, transparent 1px),
      linear-gradient(180deg, rgba(132,111,82,.06) 1px, transparent 1px),
      linear-gradient(160deg,#fff9e9 0%,#f9f1d9 48%,#f1f7ef 100%); background-size:44px 44px,44px 44px,auto; border-color:rgba(132,111,82,.18); }
    h1 { color:#2f2a1f; }
    .metric, .insights > div, .rank-row, .book-row, .section, .manifest { border-radius:18px 6px 18px 6px; background:rgba(255,253,248,.7); }
    .metric span, .rank-row em, .insights span { color:#1c7f58; }
    .timeline-strip { position:relative; grid-template-columns:repeat(5,minmax(0,1fr)); border-radius:999px; background:rgba(255,253,248,.58); padding:18px 20px; }
    .timeline-strip::before { position:absolute; top:31px; right:28px; left:28px; height:2px; background:linear-gradient(90deg,#2f80ed,#1eb869,#d6a94a); content:""; }
    .timeline-strip div { position:relative; padding-top:28px; }
    .timeline-strip div::before { position:absolute; top:8px; left:0; width:12px; height:12px; border:3px solid #fffdf8; border-radius:999px; background:#1eb869; content:""; }
    .bar-row b, .rank-row b { background:linear-gradient(90deg,#2f80ed,#1eb869,#d6a94a); }`
      : templateId === "annual"
        ? `
    body { background:#101922; color:#fffdf8; }
    main { overflow:hidden; background:
      radial-gradient(circle at 18% 18%, rgba(246,231,182,.18), transparent 24%),
      linear-gradient(145deg,#101922 0%,#18323a 52%,#1a252f 100%); border-color:rgba(246,231,182,.2); color:#fffdf8; }
    main::before { position:absolute; inset:22px; border:1px solid rgba(246,231,182,.16); content:""; pointer-events:none; }
    h1 { color:#fffdf8; font-size:64px; }
    .cover p, footer, footer span, .rank-row span, .rank-row small, .bar-row span, .bar-row small, .book-row span { color:rgba(255,253,248,.68); }
    .metric, .insights > div, .rank-row, .book-row, .section { border-color:rgba(246,231,182,.12); border-radius:4px; background:rgba(255,253,248,.1); }
    .metric span, .insights span, .rank-row em { color:#f6e7b6; }
    .metric strong, .section h2, .book-row strong { color:#fffdf8; }
    .number-wall { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; margin:30px 0; }
    .number-wall .metric strong { color:#f6e7b6; font-family:Georgia,serif; font-size:38px; }
    .annual-seal { border-color:rgba(246,231,182,.32); background:rgba(246,231,182,.08); }
    .annual-seal strong { color:#f6e7b6; font-family:Georgia,serif; font-size:62px; }
    .tag-cloud span { border-color:rgba(246,231,182,.18); background:rgba(246,231,182,.08); color:#fffdf8; }
    .bar-row i, .rank-row i { background:rgba(255,253,248,.16); }
    .bar-row b, .rank-row b { background:#f6e7b6; }`
        : `
    body { background:#eef2f4; color:#192633; }
    main { background:
      linear-gradient(rgba(25,38,51,.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(25,38,51,.045) 1px, transparent 1px),
      radial-gradient(circle at 92% 8%, rgba(30,184,105,.16), transparent 28%),
      linear-gradient(135deg,#fffdf8 0%,#f4f8ff 100%); background-size:36px 36px,36px 36px,auto,auto; border-color:rgba(25,38,51,.08); }
    .metric, .insights > div, .rank-row, .book-row, .section, .manifest { border-color:rgba(25,38,51,.08); border-radius:6px; background:rgba(255,255,255,.78); }
    .metric strong, .number-wall .metric strong { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
    .bar-row b, .rank-row b { background:linear-gradient(90deg,#2f80ed,#1eb869); }`;

  return `
    :root { font-family:"Noto Serif SC","Songti SC",serif; color:#192633; background:#f8f7f3; }
    * { box-sizing:border-box; }
    body { margin:0; padding:40px; }
    main { position:relative; max-width:1120px; margin:0 auto; border:1px solid; border-radius:24px; padding:42px; box-shadow:0 24px 70px rgba(30,24,15,.12); }
    .cover { display:grid; grid-template-columns:minmax(0,1fr) 230px; gap:24px; align-items:start; }
    .cover > div > span, footer, .seal span, .seal small { color:#756d62; font-size:13px; }
    h1 { margin:12px 0; font-size:56px; line-height:1.05; font-weight:500; overflow-wrap:anywhere; }
    h2 { margin:0 0 16px; font-size:23px; }
    .cover p { max-width:760px; color:#5f6b70; font-size:20px; line-height:1.8; }
    .manifest, .seal { border:1px solid rgba(25,38,51,.12); padding:16px; }
    .manifest { display:grid; gap:10px; }
    .manifest div { display:grid; grid-template-columns:64px minmax(0,1fr); gap:10px; align-items:baseline; border-bottom:1px solid rgba(25,38,51,.08); padding-bottom:9px; }
    .manifest div:last-child { border-bottom:0; padding-bottom:0; }
    .manifest span, .seal span { font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .manifest strong, .seal strong { display:block; overflow-wrap:anywhere; }
    .seal.round { display:grid; place-items:center; min-height:144px; border-radius:999px; }
    .seal.round strong { font-family:Georgia,serif; font-size:46px; font-weight:400; line-height:.95; }
    .metrics, .summary, .insights, .timeline-strip { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:28px 0; }
    .split, .three { display:grid; gap:18px; margin-top:26px; }
    .split { grid-template-columns:minmax(0,1fr) minmax(280px,.86fr); }
    .three { grid-template-columns:repeat(3,minmax(0,1fr)); }
    .section, .metric, .insights > div, .rank-row, .book-row { border:1px solid rgba(25,38,51,.08); padding:16px; }
    .section .section { border:0; background:transparent; padding:0; }
    .wide { margin-top:30px; }
    .metric span, .insights span { display:block; color:#2f80ed; font-size:13px; font-weight:700; }
    .metric strong { display:block; margin-top:10px; font-size:24px; }
    .bars, .rank-list, .book-list { display:grid; gap:10px; }
    .bar-row { display:grid; grid-template-columns:120px 1fr 150px; gap:12px; align-items:center; }
    .bar-row i, .rank-row i { display:block; height:9px; border-radius:99px; background:rgba(132,111,82,.12); overflow:hidden; }
    .bar-row b, .rank-row b { display:block; height:100%; border-radius:99px; }
    .insights { grid-template-columns:repeat(2,minmax(0,1fr)); margin:0; }
    .insights strong { display:block; margin-top:8px; line-height:1.8; }
    .insights small, .rank-row span, .rank-row small, .bar-row span, .bar-row small, .book-row span { color:#756d62; }
    .rank-row { display:grid; grid-template-columns:40px 1fr 110px; gap:12px; align-items:center; }
    .rank-row em, .book-row em { color:#2f80ed; font-style:normal; font-weight:800; }
    .book-row { display:grid; grid-template-columns:42px 1fr; gap:12px; }
    .book-row strong { display:block; line-height:1.55; }
    .tag-cloud { display:flex; flex-wrap:wrap; gap:8px; }
    .tag-cloud span { border:1px solid rgba(47,128,237,.12); border-radius:999px; background:rgba(244,248,255,.78); padding:8px 10px; color:#526272; font-size:13px; font-weight:700; }
    .note-signals { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .section-note { margin:14px 0 0; color:#756d62; font-size:14px; line-height:1.8; }
    footer { display:flex; justify-content:space-between; gap:18px; margin-top:40px; border-top:1px solid rgba(132,111,82,.14); padding-top:18px; }
    footer strong { white-space:nowrap; }
    ${theme}
    @media (max-width: 900px) {
      body { padding:16px; }
      main { padding:22px; border-radius:18px; }
      .cover, .split, .three { grid-template-columns:1fr; }
      h1 { font-size:38px; }
      .metrics, .summary, .insights, .timeline-strip, .number-wall { grid-template-columns:1fr 1fr; }
      .bar-row, .rank-row { grid-template-columns:1fr; }
      footer { display:grid; }
    }
    @media (max-width: 560px) {
      .metrics, .summary, .insights, .timeline-strip, .number-wall { grid-template-columns:1fr; }
    }`;
}

export function renderReportHtml(templateId: ReportTemplateId, data: ReadingReportData): string {
  const title = reportHtmlTitle(templateId, data);
  const body = bodyForTemplate(templateId, data, title);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${htmlCss(templateId)}</style>
</head>
<body>
  <main class="${templateId}-html-report">${body}</main>
</body>
</html>`;
}
