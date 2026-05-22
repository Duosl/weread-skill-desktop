import { useEffect, useRef } from "react";
import { SegmentedControl } from "../ui/SegmentedControl";

export type ModelOutputBlock = {
  kind: "thinking" | "output" | "system" | "error";
  title: string;
  text: string;
};

export type ModelOutputMode = "brief" | "detail";

type ModelOutputProps = {
  blocks: ModelOutputBlock[];
  mode: ModelOutputMode;
  onModeChange: (mode: ModelOutputMode) => void;
  statusLabel: string;
  latestLine: string;
  briefLine: string;
  latestKind?: ModelOutputBlock["kind"];
  autoScrollToEnd?: boolean;
  hideModeSwitch?: boolean;
};

export function ModelOutput({
  blocks,
  mode,
  onModeChange,
  statusLabel,
  latestLine,
  briefLine,
  latestKind = "system",
  autoScrollToEnd = false,
  hideModeSwitch = false,
}: ModelOutputProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToEndRef = useRef(true);

  function handlePanelScroll() {
    const panel = panelRef.current;
    if (!panel) return;
    const distanceToBottom = panel.scrollHeight - panel.scrollTop - panel.clientHeight;
    shouldStickToEndRef.current = distanceToBottom < 48;
  }

  useEffect(() => {
    if (!autoScrollToEnd) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (!shouldStickToEndRef.current) return;
    panel.scrollTop = panel.scrollHeight;
  }, [autoScrollToEnd, blocks, mode]);

  return (
    <section className={`advanced-task-log-section ${mode === "brief" ? "is-brief" : "is-detail"}`}>
      <div className="advanced-task-log-header">
        <div className="advanced-task-log-title">
          <strong>生成过程</strong>
          <small>{mode === "brief" ? "简洁模式只显示状态和最新内容" : blocks.length ? `${blocks.length} 段内容` : "正在等待输出"}</small>
        </div>
        {hideModeSwitch ? null : (
          <SegmentedControl
            className="advanced-task-log-mode"
            ariaLabel="生成过程显示模式"
            value={mode}
            onChange={onModeChange}
            options={[
              { value: "brief", label: "简洁" },
              { value: "detail", label: "详细" },
            ]}
          />
        )}
      </div>
      <div
        ref={panelRef}
        className={`advanced-task-log-panel ${mode === "brief" ? "brief" : ""}`}
        aria-live="off"
        onScroll={handlePanelScroll}
      >
        {blocks.length === 0 ? (
          <p className="advanced-task-log-empty">这次生成没有记录到可展示的过程。</p>
        ) : mode === "brief" ? (
          <p className={`advanced-task-log-brief ${latestKind}`}>
            <strong>{statusLabel}</strong>
            <span title={latestLine || undefined}>{briefLine}</span>
          </p>
        ) : (
          blocks.map((block, index) => (
            <article key={`${block.kind}-${index}`} className={`model-output-block ${block.kind}`}>
              <span>{block.title}</span>
              <p>{block.text}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
