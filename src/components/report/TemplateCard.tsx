import type { ReactNode } from "react";

type TemplateCardProps = {
  label: ReactNode;
  title: string;
  description: string;
  footer?: ReactNode;
  meta?: ReactNode;
  statusTone?: "success" | "running" | "danger" | "muted";
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function TemplateCard({
  label,
  title,
  description,
  footer,
  meta,
  statusTone,
  selected = false,
  disabled = false,
  onClick,
}: TemplateCardProps) {
  const toneClass = statusTone ? `is-${statusTone}` : "";

  return (
    <button
      type="button"
      className={`report-gallery-card report-template-card ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{title}</strong>
      <small>{description}</small>
      {meta ? <div className="template-card-meta">{meta}</div> : null}
      {footer || selected ? (
        <div className="template-card-footer">
          {footer ? <em>{footer}</em> : null}
          {selected ? <i aria-hidden="true" /> : null}
        </div>
      ) : null}
    </button>
  );
}
