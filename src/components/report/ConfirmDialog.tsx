import type { ReactNode } from "react";
import { Button } from "../ui/Button";

type ConfirmDialogProps = {
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel = "取消",
  onCancel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <div className="report-modal-backdrop confirm-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
          {children}
        </div>
        <div className="confirm-dialog-actions">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
