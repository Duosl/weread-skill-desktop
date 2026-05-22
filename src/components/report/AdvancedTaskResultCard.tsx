import type { ReactNode } from "react";
import { Eye, Trash2 } from "lucide-react";
import { advancedTaskStatus, taskHasReportWarning } from "../../lib/report/advancedTaskView";
import type { AdvancedReportTask } from "../../types/advancedReport";
import type { ModelOutputBlock, ModelOutputMode } from "../../types/modelOutput";
import { Button } from "../ui/Button";
import { ModelOutput } from "./ModelOutput";
import { TaskStateCard } from "./TaskStateCard";

type AdvancedTaskResultCardProps = {
  task: AdvancedReportTask;
  outputBlocks: ModelOutputBlock[];
  outputMode: ModelOutputMode;
  reportAvailable: boolean;
  latestLine: string;
  briefLine: string;
  latestKind?: ModelOutputBlock["kind"];
  meta?: ReactNode;
  onOutputModeChange: (mode: ModelOutputMode) => void;
  onCancel: (task: AdvancedReportTask) => void;
  onOpen: (task: AdvancedReportTask) => void;
  onDelete: (task: AdvancedReportTask) => void;
  onRegenerate: () => void;
};

type TaskStateTone = "success" | "running" | "warning" | "danger" | "muted";

export function AdvancedTaskResultCard({
  task,
  outputBlocks,
  outputMode,
  reportAvailable,
  latestLine,
  briefLine,
  latestKind,
  meta,
  onOutputModeChange,
  onCancel,
  onOpen,
  onDelete,
  onRegenerate,
}: AdvancedTaskResultCardProps) {
  const active = task.status === "running" || task.status === "preparing";
  const status = advancedTaskStatus(task);

  return (
    <TaskStateCard
      label={status.label}
      tone={status.tone as TaskStateTone}
      title={
        active
          ? "正在生成报告"
          : task.status === "completed"
            ? taskHasReportWarning(task)
              ? "报告已生成，有附加信息需要处理"
              : ""
            : "报告未完成"
      }
      description={
        active
          ? "可以离开当前页面，生成完成后会留在历史记录里。"
          : task.status === "completed"
            ? task.message?.trim() || "可以直接用浏览器打开查看完整报告。"
            : task.message ?? "这次生成没有产出可查看的报告。"
      }
      meta={meta}
      actions={
        active ? (
          <Button variant="danger" onClick={() => onCancel(task)}>
            取消生成
          </Button>
        ) : (
          <>
            <Button variant="secondary" icon={<Eye size={16} />} disabled={!reportAvailable} onClick={() => onOpen(task)}>
              浏览器打开
            </Button>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => onDelete(task)}>
              删除任务
            </Button>
            <Button className="task-regenerate-action" variant="secondary" onClick={onRegenerate}>
              再次生成
            </Button>
          </>
        )
      }
    >
      <ModelOutput
        blocks={outputBlocks}
        mode={outputMode}
        onModeChange={onOutputModeChange}
        statusLabel={status.label}
        latestLine={latestLine}
        briefLine={briefLine}
        latestKind={latestKind}
        autoScrollToEnd
      />
    </TaskStateCard>
  );
}
