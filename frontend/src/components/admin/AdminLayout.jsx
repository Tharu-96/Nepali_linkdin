import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import SidebarScaffold from "../layout/SidebarScaffold";

export default function AdminLayout() {
  return (
    <SidebarScaffold
      storageKey="rozgar-admin-sidebar-open"
      renderSidebar={({ closeMobile }) => <AdminSidebar onNavigate={closeMobile} />}
    >
      <div style={{ backgroundColor: "#f9fafb", overflowY: "auto" }}>
        <Outlet />
      </div>
    </SidebarScaffold>
  );
}
