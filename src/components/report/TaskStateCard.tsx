import type { ReactNode } from "react";

type TaskStateTone = "success" | "running" | "danger" | "muted";

type TaskStateCardProps = {
  label: string;
  title: string;
  description: string;
  tone: TaskStateTone;
  actions?: ReactNode;
};

export function TaskStateCard({ label, title, description, tone, actions }: TaskStateCardProps) {
  return (
    <section className={`advanced-task-status-card ${tone}`}>
      <div>
        <span>{label}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actions ? <div className="advanced-result-actions">{actions}</div> : null}
    </section>
  );
}
