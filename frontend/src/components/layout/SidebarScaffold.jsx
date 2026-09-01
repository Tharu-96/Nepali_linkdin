import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Menu, X } from "lucide-react";
import PortalNavActions from "./PortalNavActions";

const DESKTOP_BREAKPOINT = 1024;

export default function SidebarScaffold({ renderSidebar, children, storageKey = "sidebar-open", headerContent = null }) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= DESKTOP_BREAKPOINT
  );
  const [isDesktopOpen, setIsDesktopOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(storageKey);
    return saved === null ? true : saved === "true";
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      setIsDesktop(desktop);
      if (desktop) {
        setIsMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, String(isDesktopOpen));
    }
  }, [isDesktopOpen, storageKey]);

  const closeMobile = () => setIsMobileOpen(false);
  const toggleSidebar = () => {
    if (isDesktop) {
      setIsDesktopOpen((current) => !current);
      return;
    }
    setIsMobileOpen((current) => !current);
  };

  const sidebarBrand = (
    <Link to="/" className="mb-6 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md">
        <Briefcase size={20} />
      </div>
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">Rozgar</div>
      </div>
    </Link>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div
        className={`relative hidden shrink-0 overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
          isDesktopOpen ? "w-[240px]" : "w-[72px]"
        }`}
      >
        {isDesktopOpen ? (
          <div className="relative h-full w-[240px]">
            <button
              type="button"
              onClick={toggleSidebar}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-primary-200 hover:text-primary-700"
              aria-label="Collapse sidebar"
            >
              <Menu size={18} />
            </button>
            <div className="h-full overflow-y-auto px-5 py-5">
              {sidebarBrand}
              {renderSidebar({ closeMobile })}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-start justify-center pt-4">
            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-primary-200 hover:text-primary-700"
              aria-label="Expand sidebar"
            >
              <Menu size={18} />
            </button>
          </div>
        )}
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMobile}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[240px] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full bg-white shadow-xl">
          <button
            type="button"
            onClick={closeMobile}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-primary-200 hover:text-primary-700"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
          <div className="h-full overflow-y-auto px-5 py-5">
            {sidebarBrand}
            {renderSidebar({ closeMobile })}
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-5 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="min-w-0">{headerContent}</div>
          <PortalNavActions />
        </div>
        {children}
      </div>
    </div>
  );
}
