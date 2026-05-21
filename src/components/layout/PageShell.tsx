import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type PageShellProps = {
  title: ReactNode;
  backAction?: {
    label: string;
    onClick: () => void;
  };
  titleAccessory?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  tabs?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export function PageShell({
  title,
  backAction,
  titleAccessory,
  subtitle,
  meta,
  tabs,
  actions,
  toolbar,
  action,
  children,
}: PageShellProps) {
  const headerActions = actions ?? action;

  return (
    <main className="page">
      <header className="page-header">
        <div className="page-heading">
          <div className="page-title-line">
            {backAction ? (
              <button
                type="button"
                className="page-back-button"
                aria-label={backAction.label}
                onClick={backAction.onClick}
              >
                <ArrowLeft size={16} />
                <span>{backAction.label}</span>
              </button>
            ) : null}
            <h1>{title}</h1>
            {titleAccessory ? <div className="page-title-accessory">{titleAccessory}</div> : null}
          </div>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {meta ? <div className="page-meta">{meta}</div> : null}
        {headerActions ? <div className="page-actions">{headerActions}</div> : null}
      </header>
      {tabs ? <div className="page-tabs">{tabs}</div> : null}
      {toolbar ? <div className="page-toolbar">{toolbar}</div> : null}
      {children}
    </main>
  );
}
