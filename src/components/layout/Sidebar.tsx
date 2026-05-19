import { BarChart3, BookOpen, FileDown, Library, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

const navItems = [
  { to: "/", label: "概览", icon: BarChart3 },
  { to: "/shelf", label: "书架", icon: Library },
  { to: "/notes", label: "笔记", icon: BookOpen },
  { to: "/export", label: "导出", icon: FileDown },
  { to: "/settings", label: "设置", icon: Settings },
];

type SidebarProps = {
  onOpenReward?: () => void;
};

export function Sidebar({ onOpenReward }: SidebarProps) {
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    invoke<string>("get_app_version").then(setAppVersion).catch(() => {});
  }, []);

  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-mark" src="/weread-icon.png" alt="" />
        <div>
          <strong>微信读书</strong>
          <span>Skill 桌面客户端</span>
        </div>
      </div>

      <nav>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end>
            <Icon size={18} />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-reward-btn" onClick={onOpenReward}>
          <span>打赏支持</span>
          {appVersion && <small>v{appVersion}</small>}
        </button>
      </div>
    </aside>
  );
}
