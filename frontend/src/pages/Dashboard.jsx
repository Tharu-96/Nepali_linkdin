import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { jobsAPI, applicationsAPI, adminAPI } from "../api";
import AdminSidebar from "../components/admin/AdminSidebar";
import LiveChart from "../components/admin/LiveChart";
import SidebarScaffold from "../components/layout/SidebarScaffold";
import {
  AlertCircle,
  Briefcase,
  Bot,
  Building,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  Flag,
  Globe,
  Hourglass,
  Loader2,
  MessageCircle,
  PlusCircle,
  Search,
  Star,
  Users,
  Wallet,
} from "lucide-react";

const roleTitle = {
  worker: "Worker Dashboard",
  employer: "Employer Dashboard",
  admin: "Admin Dashboard",
};

function KpiCard({ to, icon: Icon, label, value, tone = "primary" }) {
  const tones = {
    primary: "bg-primary-50 text-primary-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-700",
  };

  const card = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-primary-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone] || tones.primary}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );

  return to ? <Link to={to}>{card}</Link> : card;
}

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

export default function Dashboard() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({});
  const [recentJobs, setRecentJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      try {
        if (role === "worker") {
          const [jobsRes, appsRes] = await Promise.all([
            jobsAPI.getJobs(),
            applicationsAPI.getMyApplications(),
          ]);
          const jobs = jobsRes.data || [];
          const apps = appsRes.data || [];
          setRecentJobs(jobs.slice(0, 5));
          setMyApplications(apps);
          setStats({
            totalJobs: jobs.length,
            urgentJobs: jobs.filter((j) => j.is_urgent).length,
            myApps: apps.length,
            accepted: apps.filter((a) => a.status === "accepted").length,
          });
        } else if (role === "employer") {
          const jobsRes = await jobsAPI.getJobs();
          const jobs = jobsRes.data || [];
          const myJobs = jobs.filter((j) => j.employer_id === user?.id);
          setRecentJobs(myJobs.slice(0, 5));
          setStats({
            myJobs: myJobs.length,
            totalJobs: jobs.length,
            urgentJobs: jobs.filter((j) => j.is_urgent).length,
          });
        } else if (role === "admin") {
          const kpiRes = await adminAPI.getKpiStats();
          const kpi = kpiRes.data || {};
          setStats({
            totalUsers: kpi.total_users ?? 0,
            totalWorkers: kpi.total_workers ?? 0,
            totalEmployers: kpi.total_employers ?? 0,
            pendingApprovals: kpi.pending_approvals ?? 0,
            totalReports: kpi.total_reports ?? 0,
            pendingReports: kpi.pending_reports ?? 0,
            revenueThisMonth: kpi.revenue_this_month ?? 0,
          });
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [role, user?.id]);

  const kpis = useMemo(() => {
    if (role === "worker") {
      return [
        { to: "/jobs", icon: ClipboardList, label: "Available Jobs", value: stats.totalJobs ?? 0 },
        { to: "/jobs?filter=urgent", icon: AlertCircle, label: "Urgent Jobs", value: stats.urgentJobs ?? 0, tone: "red" },
        { to: "/jobs?tab=applications", icon: FileCheck, label: "Applications", value: stats.myApps ?? 0, tone: "blue" },
        { to: "/jobs?tab=applications&status=accepted", icon: CheckCircle2, label: "Accepted", value: stats.accepted ?? 0, tone: "emerald" },
      ];
    }

    if (role === "employer") {
      return [
        { to: "/jobs", icon: Briefcase, label: "My Posted Jobs", value: stats.myJobs ?? 0 },
        { to: "/jobs/all", icon: Globe, label: "Platform Jobs", value: stats.totalJobs ?? 0, tone: "emerald" },
        { to: "/jobs/all", icon: AlertCircle, label: "Urgent Jobs", value: stats.urgentJobs ?? 0, tone: "red" },
        { to: "/jobs/post", icon: PlusCircle, label: "New Job", value: "Post", tone: "blue" },
      ];
    }

    return [
      { to: "/admin/workers", icon: Users, label: "Total Users", value: stats.totalUsers ?? 0 },
      { to: "/admin/workers", icon: Users, label: "Workers", value: stats.totalWorkers ?? 0, tone: "slate" },
      { to: "/admin/employers", icon: Building, label: "Employers", value: stats.totalEmployers ?? 0, tone: "blue" },
      { to: "/admin/transactions", icon: Wallet, label: "Revenue", value: `Rs. ${Number(stats.revenueThisMonth || 0).toLocaleString()}`, tone: "emerald" },
    ];
  }, [role, stats]);

  const shortcuts = useMemo(() => {
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
  }, [role]);

  const dashboardHeader = (
    <div>
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{roleTitle[role] || "Dashboard"}</h1>
      <p className="mt-1 hidden text-sm text-slate-500 sm:block">
        Welcome back, {user?.name || "User"}.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary-600" />
        <p className="text-sm font-medium text-slate-600">Loading dashboard...</p>
      </div>
    );
  }

  if (role === "admin") {
    return (
      <SidebarScaffold
        storageKey="rozgar-admin-sidebar-open"
        renderSidebar={({ closeMobile }) => <AdminSidebar onNavigate={closeMobile} />}
        headerContent={dashboardHeader}
      >
        <main style={{ backgroundColor: "#f9fafb", overflowY: "auto" }}>
          <div className="px-5 py-5 sm:px-6 lg:px-8">
            <div className="space-y-5">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((item) => (
                  <KpiCard key={item.label} {...item} />
                ))}
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Platform Analytics</h2>
                  <p className="mt-1 text-sm text-slate-500">Live admin charts refresh automatically.</p>
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                  <LiveChart type="user_growth" title="User Growth Over Time" chartType="line" />
                  <LiveChart type="job_postings" title="Job Postings Over Time" chartType="bar" />
                  <LiveChart type="applications" title="Applications Submitted" chartType="line" />
                  <LiveChart type="job_status" title="Job Status Breakdown" chartType="pie" />
                  <LiveChart type="revenue" title="Rozgar Revenue (eSewa vs Khalti)" chartType="bar" />
                  <LiveChart type="active_users" title="Active Users Trend" chartType="area" />
                </div>
              </section>
            </div>
          </div>
        </main>
      </SidebarScaffold>
    );
  }

  return (
    <SidebarScaffold
      storageKey={`rozgar-${role}-sidebar-open`}
      headerContent={dashboardHeader}
      renderSidebar={({ closeMobile }) => (
        <RoleSidebar
          title={roleTitle[role] || "Dashboard"}
          items={shortcuts}
          onNavigate={closeMobile}
        />
      )}
    >
      <main style={{ backgroundColor: "#f9fafb", overflowY: "auto" }}>
        <div className="px-5 py-5 sm:px-6 lg:px-8">
          <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((item) => (
              <KpiCard key={item.label} {...item} />
            ))}
          </section>

          {role === "worker" && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">Recent Applications</h2>
              </div>
              {myApplications.length ? (
                <div>
                  <div className="grid grid-cols-3 items-center border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <div className="text-left">Job</div>
                    <div className="text-center">Status</div>
                    <div className="text-right">Applied</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {myApplications.slice(0, 5).map((app) => (
                      <div
                        key={app.id}
                        className="grid grid-cols-3 items-center px-6 py-4"
                      >
                        <div className="min-w-0 pr-4 text-left font-semibold text-slate-900">
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                            {app.job?.title || `Job #${app.job_id}`}
                          </span>
                        </div>
                        <div className="flex justify-center">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            app.status === "accepted"
                              ? "bg-emerald-50 text-emerald-700"
                              : app.status === "rejected"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                          }`}>
                            {app.status}
                          </span>
                        </div>
                        <div className="whitespace-nowrap text-right text-slate-600">
                          {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "Not available"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-5 py-8 text-sm text-slate-500">No applications yet.</div>
              )}
            </section>
          )}

          {role !== "admin" && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  {role === "employer" ? "Recent Posted Jobs" : "Latest Jobs"}
                </h2>
                <Link to="/jobs" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
                  View all
                </Link>
              </div>
              {recentJobs.length ? (
                <div className="divide-y divide-slate-100">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-900">{job.title || "Untitled job"}</h3>
                          {job.is_urgent && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {job.location || "Location not specified"} · {job.salary || job.budget || "Salary not specified"}
                        </p>
                      </div>
                      <Link to={`/jobs/${job.id}`} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
                        Details
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-sm text-slate-500">
                  {role === "employer" ? "No jobs posted yet." : "No jobs found."}
                </div>
              )}
            </section>
          )}
          </div>
        </div>
      </main>
    </SidebarScaffold>
  );
}
