import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

type ToolbarProps = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

export function Toolbar({ sidebarCollapsed, onToggleSidebar }: ToolbarProps) {
  return (
    <div className="toolbar" data-tauri-drag-region>
      <div className="toolbar-left">
        <button
          className="toolbar-btn"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <div className="toolbar-drag-region" data-tauri-drag-region />
    </div>
  );
}
