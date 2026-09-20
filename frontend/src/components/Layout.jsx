import React, { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Printer,
  LayoutDashboard,
  Plus,
  Files,
  ListOrdered,
  Sparkles,
  BarChart3,
  Settings,
  ArrowUpRight,
  Leaf,
  ShieldCheck,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  Users,
  IndianRupee,
  CheckCheck,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../hooks/useWorkspace";
import { Modal, FileLabel, Badge } from "./UI";
import { api, number } from "../services/api";
export function Brand() {
  return (
    <Link className="brand" to="/home">
      <span className="brand-mark">
        <Printer />
      </span>
      <span>
        AutoPrint <b>AI</b>
        <small>INTELLIGENT PRINTING</small>
      </span>
    </Link>
  );
}
export default function Layout() {
  const { data } = useWorkspace();
  const loc = useLocation(),
    navigate = useNavigate();
  const admin = loc.pathname.startsWith("/admin");
  const [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    try {
      await api("/admin/logout", {}, "POST");
      setMobile(false);
      navigate("/admin/login", { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSigningOut(false);
    }
  }
  const links = admin
    ? [
        [LayoutDashboard, "Overview", "/admin"],
        [Files, "Orders", "/admin/orders"],
        [ListOrdered, "Print Queue", "/admin/queue"],
        [Printer, "Printers", "/admin/printers"],
        [Users, "Users", "/admin/users"],
        [IndianRupee, "Pricing", "/admin/pricing"],
        [BarChart3, "Analytics", "/admin/analytics"],
        [Sparkles, "AI Insights", "/admin/insights"],
        [Settings, "System Settings", "/admin/settings"],
      ]
    : [
        [Plus, "New Print", "/new"],
        [Sparkles, "AI Insights", "/insights"],
  
      ];
  const title =
    links.find((l) => l[2] === loc.pathname)?.[1] ||
    (loc.pathname.startsWith("/jobs/") ? "Job tracking" : "Workspace");
  const active =
    data?.jobs.filter((j) =>
      ["Queued", "Printing", "Sent to Controller"].includes(j.status),
    ) || [];
  return (
    <div className="app-shell">
      {mobile && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <Brand />
        <div className="workspace">
          <span className="workspace-monogram">P</span>
          <div>
            Printing Shop
            <small>
              {admin ? "Administrator" : ""}
            </small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">{admin ? "MANAGEMENT" : "WORKSPACE"}</div>
        <nav>
          {links.map(([Icon, n, to]) => (
            <NavLink key={to} end to={to} onClick={() => setMobile(false)}>
              <Icon size={19} />
              {n}
              {n === "Print Queue" && active.length > 0 && (
                <span className="nav-count">{active.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {admin && (
            <button className="admin-signout" onClick={signOut} disabled={signingOut}>
              <LogOut size={17} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
          {!admin && (
            <div className="eco">
              <Leaf size={20} />
              <b>{number(data?.stats.saved)} sheets. Saved.</b>
              <span>
                A little less paper.
                <br />A lot more possibility.
              </span>
              <Link to="/usage">
                See your impact <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          <Link to={admin ? "/" : "/admin"} onClick={() => setMobile(false)}>
            <ShieldCheck size={17} />
            {admin ? "Back to workspace" : "Admin workspace"}
            <ArrowUpRight size={15} />
          </Link>
          <Link to="/home">
            About AutoPrint <ArrowUpRight size={15} />
          </Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            {admin ? "Administration" : "Workspace"}
            <span className="slash">/</span>
            <b>{title}</b>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("/jobs?q=" + encodeURIComponent(query));
              }}
            >
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search print jobs…"
                aria-label="Search print jobs"
              />
              <kbd>↵</kbd>
            </form>
            <span className="demo-tag"></span>
            <button
              className="icon-button bell"
              aria-label="Notifications"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {active.length > 0 && data?.profile.notify && <i />}
            </button>
            <Link
              className="avatar"
              to={admin ? "/admin/settings" : "/settings"}
              aria-label="Profile settings"
            >
              {(data?.profile.name || "Campus member")
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            AutoPrint AI <span>·</span> Intelligent printing, thoughtfully done.
          </span>
          <span>
            SIH 2026 <span>·</span> Simulated payments & printing
          </span>
        </footer>
      </div>
      <Modal
        open={notifications}
        onClose={() => setNotifications(false)}
        title="Print updates"
      >
        {active.length ? (
          active.map((j) => (
            <Link
              className="notification"
              to={"/jobs/" + j.id}
              onClick={() => setNotifications(false)}
              key={j.id}
            >
              <FileLabel name={j.document_name} meta={j.id} />
              <Badge status={j.status} />
            </Link>
          ))
        ) : (
          <div className="empty">
            <CheckCheck />
            <h3>You’re all caught up</h3>
            <p>Your active print jobs will appear here.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
