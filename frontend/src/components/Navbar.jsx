import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCallback, useEffect, useState } from "react";
import { chatAPI } from "../api";
import { Menu, X, Briefcase, LogOut, Bell } from "lucide-react";

export default function Navbar() {
  const { isAuthenticated, user, role, token, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await chatAPI.getUnreadCount();
      setUnread(res.data.unread_count);
    } catch {
      /* ignore */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);
    window.addEventListener("focus", fetchUnread);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchUnread);
    };
  }, [fetchUnread, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !token || role === "admin") return;

    const configuredWsUrl = import.meta.env.VITE_WS_URL;
    const target = configuredWsUrl || window.location.origin;
    const wsUrl = new URL(target, window.location.origin);
    wsUrl.protocol = wsUrl.protocol === "https:" || wsUrl.protocol === "wss:" ? "wss:" : "ws:";
    if (!configuredWsUrl || wsUrl.pathname === "/" || wsUrl.pathname === "") {
      wsUrl.pathname = "/ws/chat";
    }
    wsUrl.searchParams.set("token", token);

    const ws = new WebSocket(wsUrl.toString());
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message" && data.data?.receiver_id === user?.id) {
          fetchUnread();
        }
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, [fetchUnread, isAuthenticated, role, token, user?.id]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const unreadBadge = unread > 99 ? "99+" : String(unread);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-primary-600 text-white flex items-center justify-center rounded-xl shadow-md group-hover:scale-105 transition-transform">
              <Briefcase size={20} />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900">
              Rozgar
            </span>
          </Link>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-slate-500 hover:text-slate-900 focus:outline-none p-2"
            >
              {menuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="max-w-40 truncate rounded-full bg-primary-50 px-3 py-1 text-xs font-bold tracking-wide text-primary-700 transition-colors hover:bg-primary-100 hover:text-primary-800"
                >
                  {user?.name || "User"}
                </Link>
                {role !== "admin" && (
                  <Link
                    to="/chat"
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-primary-200 hover:text-primary-600"
                    title="Notifications"
                    aria-label="Notifications"
                  >
                    <Bell size={18} />
                    {unread > 0 && (
                      <span className="absolute -right-2 -top-2 inline-flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-md ring-2 ring-white animate-pulse">
                        {unreadBadge}
                      </span>
                    )}
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-rose-200 hover:text-rose-600"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-slate-600 hover:text-primary-600 font-semibold transition-colors">
                  Log in
                </Link>
                <Link to="/register" className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition-all shadow-primary-500/20">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-xl absolute w-full left-0 z-40">
          <div className="px-4 pt-2 pb-6 space-y-1">
            {isAuthenticated ? (
              <>
                {role !== "admin" && (
                  <Link to="/chat" onClick={() => setMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-primary-600 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell size={18} /> Notifications
                    </div>
                    {unread > 0 && (
                      <span className="inline-flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full bg-rose-600 px-2 text-xs font-bold text-white">{unreadBadge}</span>
                    )}
                  </Link>
                )}
                
                <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="w-full text-left mt-2 block px-3 py-3 rounded-md text-base font-medium text-danger hover:bg-red-50 flex items-center gap-3">
                  <LogOut size={18} /> Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block w-full text-center px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold hover:border-slate-300">
                  Log in
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="block w-full text-center px-4 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
