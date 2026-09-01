import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Briefcase,
  Bot,
  ClipboardList,
  FileCheck,
  Globe,
  MessageCircle,
  PlusCircle,
  Search,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SidebarScaffold from "./SidebarScaffold";

const roleTitle = {
  worker: "Worker Dashboard",
  employer: "Employer Dashboard",
};

function Shortcut({ to, icon: Icon, label, onNavigate }) {
  const location = useLocation();
  const target = new URL(to, window.location.origin);
  const isActive =
    location.pathname === target.pathname &&
    location.search === target.search;

  const navStyles = {
    padding: "10px 16px",
    textDecoration: "none",
    color: isActive ? "#4f46e5" : "#4b5563",
    backgroundColor: isActive ? "#eef2ff" : "transparent",
    borderRadius: "8px",
    fontWeight: isActive ? 600 : 500,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  };

  return (
    <Link to={to} style={navStyles} onClick={onNavigate} aria-current={isActive ? "page" : undefined}>
      <Icon size={18} />
      {label}
    </Link>
  );
}

function RoleSidebar({ title, items, onNavigate }) {
  return (
    <div>
      <h2 style={{ fontSize: "18px", marginBottom: "24px", color: "#111827" }}>{title}</h2>
      <nav>
        {items.map((item) => (
          <Shortcut key={item.label} {...item} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );
}

function getShortcuts(role) {
  if (role === "employer") {
    return [
      { to: "/dashboard", icon: Briefcase, label: "Dashboard" },
      { to: "/profile", icon: Users, label: "Profile" },
      { to: "/jobs/post", icon: PlusCircle, label: "Post Job" },
      { to: "/jobs", icon: Briefcase, label: "My Jobs" },
      { to: "/reviews", icon: Star, label: "Reviews" },
      { to: "/payment/history", icon: Wallet, label: "Payments" },
      { to: "/jobs/all", icon: Globe, label: "Platform Jobs" },
      { to: "/chat", icon: MessageCircle, label: "Chat" },
      { to: "/assistant", icon: Bot, label: "AI Assistant" },
    ];
  }

  return [
    { to: "/dashboard", icon: ClipboardList, label: "Dashboard" },
    { to: "/profile", icon: Users, label: "Profile" },
    { to: "/jobs", icon: Search, label: "Browse Jobs" },
    { to: "/jobs?tab=applications", icon: FileCheck, label: "Applications" },
    { to: "/reviews", icon: Star, label: "Ratings" },
    { to: "/payment/history", icon: Wallet, label: "Payments" },
    { to: "/chat", icon: MessageCircle, label: "Chat" },
    { to: "/assistant", icon: Bot, label: "AI Assistant" },
  ];
}

export default function RolePortalLayout({ children }) {
  const { role } = useAuth();
  const shortcuts = getShortcuts(role);

  return (
    <SidebarScaffold
      storageKey={`rozgar-${role}-sidebar-open`}
      renderSidebar={({ closeMobile }) => (
        <RoleSidebar
          title={roleTitle[role] || "Dashboard"}
          items={shortcuts}
          onNavigate={closeMobile}
        />
      )}
    >
      {children || <Outlet />}
    </SidebarScaffold>
  );
}
