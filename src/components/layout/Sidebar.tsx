import { BarChart3, BookOpen, FileText, Heart, Library, MessageCircle, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "概览", icon: BarChart3 },
  { to: "/shelf", label: "我的书架", icon: Library },
  { to: "/notes", label: "划线与想法", icon: BookOpen },
  { to: "/reports", label: "读书报告", icon: FileText },
  { to: "/settings", label: "设置", icon: Settings },
];

type SidebarProps = {
  onOpenCommunity?: () => void;
  onOpenSupport?: () => void;
};

export function Sidebar({ onOpenCommunity, onOpenSupport }: SidebarProps) {
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
        <div className="sidebar-support-actions">
          <button type="button" className="sidebar-reward-btn community-action" onClick={onOpenCommunity}>
            <MessageCircle size={14} />
            <span>加交流群</span>
          </button>
          <button type="button" className="sidebar-reward-btn support-action" onClick={onOpenSupport}>
            <Heart size={14} />
            <span>打赏支持</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
