import { Download, PanelLeftClose, PanelLeftOpen } from "lucide-react";

type ToolbarProps = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  updateReady?: boolean;
  onInstallUpdate?: () => void;
};

export function Toolbar({ sidebarCollapsed, onToggleSidebar, updateReady, onInstallUpdate }: ToolbarProps) {
  return (
    <div className="toolbar" data-tauri-drag-region>
      <div className="toolbar-left">
        <button
          type="button"
          className="toolbar-btn"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        {updateReady && onInstallUpdate && (
          <button
            type="button"
            className="toolbar-update-action"
            onClick={onInstallUpdate}
            title="新版本已下载，点击重启更新"
            aria-label="重启安装更新"
          >
            <span className="update-dot" aria-hidden="true" />
            <Download size={14} strokeWidth={1.5} />
            <span>重启更新</span>
          </button>
        )}
      </div>
      <div className="toolbar-drag-region" data-tauri-drag-region />
      <div className="toolbar-right" />
    </div>
  );
}
