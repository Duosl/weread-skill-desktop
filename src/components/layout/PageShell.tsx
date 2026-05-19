import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function PageShell({ title, eyebrow, action, children }: PageShellProps) {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}
