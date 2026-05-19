import { BookOpen, FileDown, Library, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "书架", icon: Library },
  { to: "/notes", label: "笔记", icon: BookOpen },
  { to: "/export", label: "导出", icon: FileDown },
  { to: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-mark" src="/weread-icon.png" alt="" />
        <div>
          <strong>微信读书</strong>
          <span>桌面导出工具</span>
        </div>
      </div>

      <nav>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon size={18} />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
