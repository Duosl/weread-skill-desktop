import type { AdvancedReportLogEvent, AdvancedReportTask } from "../../types/advancedReport";
import type { ModelOutputBlock } from "../../types/modelOutput";

export function taskHasReportWarning(task: AdvancedReportTask) {
  return task.status === "completed" && Boolean(task.message?.trim()) && task.message?.trim() !== "报告已生成";
}

export function advancedTaskStatus(task: AdvancedReportTask) {
  if (taskHasReportWarning(task)) {
    return { label: "有警告", tone: "warning" };
  }
  if (task.status === "completed") {
    return { label: "已完成", tone: "success" };
  }
  if (task.status === "running" || task.status === "preparing") {
    return { label: "生成中", tone: "running" };
  }
  if (task.status === "canceled") {
    return { label: "已取消", tone: "muted" };
  }
  if (task.message?.includes("中断")) {
    return { label: "已中断", tone: "danger" };
  }
  return { label: "未完成", tone: "danger" };
}

export function buildModelOutputBlocks(logs: AdvancedReportLogEvent[], task?: AdvancedReportTask | null): ModelOutputBlock[] {
  const blocks: ModelOutputBlock[] = [];

  function append(kind: ModelOutputBlock["kind"], title: string, text: string) {
    const normalized = normalizeLogText(text, kind);
    if (!normalized.trim()) return;
    const previous = blocks[blocks.length - 1];
    if (previous?.kind === kind) {
      previous.text = joinLogText(previous.text, normalized, kind);
      return;
    }
    blocks.push({ kind, title, text: normalized });
  }

  for (const log of logs) {
    if (log.kind === "meta") {
      const parsed = parseMetaLog(log.text);
      if (!parsed || shouldHideMetaLog(parsed.key, parsed.value)) continue;
      if (parsed.key === "thinking") {
        append("thinking", "思考", parsed.value);
      }
      continue;
    }
    if (log.kind === "delta" || log.kind === "raw") {
      append("output", "输出", log.text);
      continue;
    }
    if (log.kind === "html") {
      append("system", "报告文件", "已收到报告内容片段。");
      continue;
    }
    if (log.kind === "stderr" || log.kind === "error") {
      append("error", "错误", log.text);
      continue;
    }
    if (log.kind === "start") {
      append("system", "状态", log.text);
      continue;
    }
    if (log.kind === "done") {
      if (task?.status === "failed") {
        append("error", "失败", task.message?.trim() || "任务失败，未生成报告。");
      } else if (task?.status === "canceled") {
        append("system", "状态", "任务已取消。");
      } else if (task?.status === "completed") {
        append("system", "状态", "任务已完成。");
      } else {
        append("system", "状态", log.text);
      }
      continue;
    }
    if (log.kind === "canceled") {
      append("system", "状态", "任务已取消。");
    }
  }

  return blocks;
}

export function latestModelOutputBlock(blocks: ModelOutputBlock[]) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.kind === "output" || block.kind === "thinking" || block.kind === "error") {
      return block;
    }
  }
  return blocks.length ? blocks[blocks.length - 1] : null;
}

export function lastVisibleLine(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

export function leadingEllipsisLine(text: string, maxLength = 96) {
  const chars = Array.from(text.trim());
  if (chars.length <= maxLength) return text.trim();
  return `…${chars.slice(-maxLength).join("")}`;
}

export function trailingEllipsisLine(text: string, maxLength = 96) {
  const chars = Array.from(text.trim());
  if (chars.length <= maxLength) return text.trim();
  return `${chars.slice(0, maxLength).join("")}…`;
}

function parseMetaLog(text: string): { key: string; value: string } | null {
  const index = text.indexOf(":");
  if (index < 0) return null;
  const key = text.slice(0, index).trim();
  const value = decodePossiblyQuotedLogText(text.slice(index + 1).trim());
  return key ? { key, value } : null;
}

function shouldHideMetaLog(key: string, value: string) {
  if (!value) return true;
  return ["model", "session", "cwd", "usage", "usage_partial"].includes(key);
}

function normalizeLogText(text: string, kind: ModelOutputBlock["kind"]) {
  const decoded = decodeLogText(text).replace(/\r/g, "");
  return kind === "thinking" || kind === "output" ? decoded : decoded.trim();
}

function decodePossiblyQuotedLogText(text: string) {
  if (text.startsWith("\"") && text.endsWith("\"")) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "string") return parsed;
    } catch {
      // Fall back to lightweight decoding below.
    }
  }
  return decodeLogText(text.replace(/^"|"$/g, ""));
}

function decodeLogText(text: string) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"");
}

function joinLogText(previous: string, next: string, kind: ModelOutputBlock["kind"]) {
  if (!previous) return next;
  if (kind === "thinking" || kind === "output") {
    return `${previous}${next}`;
  }
  if (/^[，。！？、；：,.!?;:)\]}]/.test(next) || previous.endsWith("\n")) {
    return `${previous}${next}`;
  }
  if (/[\s([{]$/.test(previous)) {
    return `${previous}${next}`;
  }
  return `${previous}\n${next}`;
}
