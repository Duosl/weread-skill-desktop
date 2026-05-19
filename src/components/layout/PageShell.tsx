import type { ReactNode } from "react";

type PageShellProps = {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export function PageShell({ title, action, children }: PageShellProps) {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}
