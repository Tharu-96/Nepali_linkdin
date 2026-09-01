import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { notificationsAPI } from "../../api";

export default function PortalNavActions() {
  const { user, role, token, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (role === "admin") return;
    try {
      const response = await notificationsAPI.getUnreadCount();
      setUnread(response.data.unread_count || 0);
    } catch {
      // A notification count should never prevent navigation from rendering.
    }
  }, [role]);

  useEffect(() => {
    if (role === "admin") return undefined;
    fetchUnread();
    const interval = window.setInterval(fetchUnread, 5000);
    window.addEventListener("focus", fetchUnread);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", fetchUnread);
    };
  }, [fetchUnread, role]);

  const loadNotifications = useCallback(async () => {
    if (role === "admin") return;
    try {
      const response = await notificationsAPI.getNotifications();
      setNotifications(response.data || []);
    } catch {
      // The badge remains usable even if the notification history cannot load.
    }
  }, [role]);

  useEffect(() => {
    if (role === "admin" || !token) return undefined;

    const configuredWsUrl = import.meta.env.VITE_WS_URL;
    const target = configuredWsUrl || window.location.origin;
    const wsUrl = new URL(target, window.location.origin);
    wsUrl.protocol = wsUrl.protocol === "https:" || wsUrl.protocol === "wss:" ? "wss:" : "ws:";
    if (!configuredWsUrl || wsUrl.pathname === "/" || wsUrl.pathname === "") wsUrl.pathname = "/ws/chat";
    wsUrl.searchParams.set("token", token);

    const socket = new WebSocket(wsUrl.toString());
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          (data.type === "message" && data.data?.receiver_id === user?.id) ||
          data.type === "notification"
        ) {
          fetchUnread();
          if (data.type === "notification") loadNotifications();
        }
      } catch {
        // Ignore malformed socket messages.
      }
    };
    return () => socket.close();
  }, [fetchUnread, loadNotifications, role, token, user?.id]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const unreadBadge = unread > 99 ? "99+" : String(unread);
  const canOpenProfile = role === "worker" || role === "employer";

  const toggleNotifications = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) await loadNotifications();
  };

  const openNotification = async (notification) => {
    if (!notification.is_read) {
      try {
        await notificationsAPI.markRead(notification.id);
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
        fetchUnread();
      } catch {
        // Navigation should still work when marking the notification fails.
      }
    }
    setIsOpen(false);
    navigate(notification.link || "/dashboard");
  };

  return (
    <div className="flex items-center gap-3">
      {canOpenProfile ? (
        <Link
          to="/profile"
          className="max-w-36 truncate rounded-full bg-primary-50 px-3 py-1 text-xs font-bold tracking-wide text-primary-700 transition-colors hover:bg-primary-100 hover:text-primary-800 sm:max-w-none"
        >
          {user?.name || "User"}
        </Link>
      ) : (
        <span className="max-w-36 truncate rounded-full bg-primary-50 px-3 py-1 text-xs font-bold tracking-wide text-primary-700 sm:max-w-none">
          {user?.name || "Admin"}
        </span>
      )}
      {role !== "admin" && (
        <div className="relative">
          <button
            type="button"
            onClick={toggleNotifications}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-primary-200 hover:text-primary-600"
          title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-2 -top-2 inline-flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-md ring-2 ring-white animate-pulse">
                {unreadBadge}
              </span>
            )}
          </button>
          {isOpen && (
            <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="font-semibold text-slate-900">Notifications</span>
                <button type="button" onClick={async () => { await notificationsAPI.markAllRead(); setNotifications((items) => items.map((item) => ({ ...item, is_read: true }))); fetchUnread(); }} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700">
                  <CheckCheck size={15} /> Mark all read
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length ? notifications.map((notification) => (
                  <button key={notification.id} type="button" onClick={() => openNotification(notification)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${notification.is_read ? "bg-white" : "bg-primary-50/60"}`}>
                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{notification.body}</p>
                  </button>
                )) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">No platform notifications yet.</p>
                )}
              </div>
              <Link to="/chat" onClick={() => setIsOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-semibold text-primary-600 hover:bg-primary-50">Open Chat</Link>
            </div>
          )}
        </div>
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
    </div>
  );
}
