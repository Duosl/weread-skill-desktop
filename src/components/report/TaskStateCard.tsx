import type { ReactNode } from "react";

type TaskStateTone = "success" | "running" | "warning" | "danger" | "muted";

type TaskStateCardProps = {
  label: string;
  title: string;
  description: string;
  tone: TaskStateTone;
  meta?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
};

export function TaskStateCard({ label, title, description, tone, meta, children, actions }: TaskStateCardProps) {
  return (
    <section className={`advanced-task-status-card ${tone}`}>
      <div className="advanced-task-status-main">
        <span className={`task-status-badge ${tone}`}>{label}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
          {meta}
        </div>
      </div>
      {actions ? <div className="advanced-result-actions">{actions}</div> : null}
      {children ? <div className="advanced-task-status-extra">{children}</div> : null}
    </section>
  );
}
