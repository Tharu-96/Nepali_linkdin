import { NavLink } from "react-router-dom";
import { BarChart3, Briefcase, Building, ClipboardList, Flag, MessageCircle, Star, Users, Wallet } from "lucide-react";

const adminNavItems = [
  { to: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { to: "/admin/workers", icon: Users, label: "Workers" },
  { to: "/admin/employers", icon: Building, label: "Employers" },
  { to: "/admin/jobs", icon: Briefcase, label: "Jobs List" },
  { to: "/admin/transactions", icon: Wallet, label: "Transactions" },
  { to: "/admin/reviews", icon: Star, label: "Reviews" },
  { to: "/admin/chatbot", icon: MessageCircle, label: "Chatbot" },
  { to: "/admin/audit-logs", icon: ClipboardList, label: "Audit Log" },
  { to: "/admin/reports", icon: Flag, label: "Reports" },
];

export default function AdminSidebar({ onNavigate }) {
  const navStyles = ({ isActive }) => ({
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
  });

  return (
    <div>
      <h2 style={{ fontSize: "18px", marginBottom: "24px", color: "#111827" }}>Admin Panel</h2>
      <nav>
        {adminNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={navStyles} onClick={onNavigate}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
