import type { ReactNode } from "react";
import {
  advancedTaskStatus,
  buildModelOutputBlocks,
  lastVisibleLine,
  latestModelOutputBlock,
  leadingEllipsisLine,
} from "../../lib/report/advancedTaskView";
import type { AdvancedReportLogEvent, AdvancedReportTask } from "../../types/advancedReport";
import type { ModelOutputMode } from "../../types/modelOutput";
import { EmptyState } from "../ui/EmptyState";
import { ModelOutput } from "./ModelOutput";

type AdvancedTaskHistoryProps = {
  tasks: AdvancedReportTask[];
  expandedTask: AdvancedReportTask | null;
  logsByJob: Record<string, AdvancedReportLogEvent[]>;
  mode: ModelOutputMode;
  onModeChange: (mode: ModelOutputMode) => void;
  renderTrace: (task: AdvancedReportTask, className?: string) => ReactNode;
  onToggleTask: (task: AdvancedReportTask) => void;
  onOpen: (task: AdvancedReportTask) => void;
  onDelete: (task: AdvancedReportTask) => void;
};

export function AdvancedTaskHistory({
  tasks,
  expandedTask,
  logsByJob,
  mode,
  onModeChange,
  renderTrace,
  onToggleTask,
  onOpen,
  onDelete,
}: AdvancedTaskHistoryProps) {
  return (
    <section className="advanced-template-panel advanced-template-history">
      <div className="template-detail-section-title">
        <h2>历史记录</h2>
      </div>
      {tasks.length === 0 ? (
        <EmptyState title="还没有历史记录" description="生成一次后，这里会显示该模板的历史报告。" />
      ) : (
        <div className="report-history-panel">
          {tasks.map((task) => {
            const completed = task.status === "completed";
            const active = task.status === "running" || task.status === "preparing";
            const status = advancedTaskStatus(task);
            const expanded = expandedTask?.jobId === task.jobId;
            const message = task.status === "completed" ? "" : task.message?.trim();
            const outputBlocks = expanded ? buildModelOutputBlocks(logsByJob[task.jobId] ?? [], task) : [];
            const latestBlock = latestModelOutputBlock(outputBlocks);
            const latestLine = latestBlock ? lastVisibleLine(latestBlock.text) : "";
            const briefLine = leadingEllipsisLine(latestLine || "正在等待新的输出。");

            return (
              <article
                key={task.jobId}
                className={`report-history-row ${expanded ? "is-expanded" : ""}`}
                onClick={() => onToggleTask(task)}
              >
                <div className="report-history-content">
                  <div className="report-history-head">
                    <span className={`report-history-status ${status.tone}`}>{status.label}</span>
                    <time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString()}</time>
                    {renderTrace(task, "is-inline")}
                  </div>
                  {message ? <p>{message}</p> : null}
                </div>
                <div className="report-history-actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="inline-secondary-action"
                    disabled={!completed}
                    onClick={() => onOpen(task)}
                  >
                    浏览器打开
                  </button>
                  <button
                    type="button"
                    className="inline-danger-action"
                    disabled={active}
                    onClick={() => onDelete(task)}
                  >
                    删除
                  </button>
                </div>
                {expanded ? (
                  <div className="report-history-expanded" onClick={(event) => event.stopPropagation()}>
                    <ModelOutput
                      blocks={outputBlocks}
                      mode={mode}
                      onModeChange={onModeChange}
                      statusLabel={status.label}
                      latestLine={latestLine}
                      briefLine={briefLine}
                      latestKind={latestBlock?.kind}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
