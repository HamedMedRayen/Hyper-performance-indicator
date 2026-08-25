import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { useTheme } from "../../utils/theme";
import { api } from "../../utils/api";
import { HpiLogo } from "../../utils/icons";
import {
  LayoutDashboard, Dumbbell, Dna, Users, Sparkles,
  Moon, Trophy, Settings, LogOut, Activity, Flame, ArrowUpRight, ShieldCheck, Bug, Flag, FileText, Shield
} from "lucide-react";
import ReportBugModal from "../modals/ReportBugModal";

/* ── Main Theme Section Groups ────────────────────── */
const MAIN_SECTIONS = [
  {
    id: "command",
    title: "Command Center",
    subtitle: "Overview & AI Engine",
    path: "/",
    end: true,
    Icon: LayoutDashboard,
    badge: "AI Active",
  },
  {
    id: "training",
    title: "Training Hub",
    subtitle: "Workouts & Logs",
    path: "/workouts",
    end: false,
    Icon: Dumbbell,
    badge: "Active",
  },
  {
    id: "biometrics",
    title: "Biometrics",
    subtitle: "Health & Telemetry",
    path: "/measurements",
    end: false,
    Icon: Dna,
  },
  {
    id: "coaching",
    title: "Coach Zone",
    subtitle: "Directory & Events",
    path: "/coach",
    end: false,
    Icon: Users,
  },
];

const ADMIN_SECTIONS = [
  {
    id: "overview",
    title: "Admin Overview",
    subtitle: "System Stats & Metrics",
    path: "/admin",
    tab: "overview",
    Icon: LayoutDashboard,
    badge: "Live",
  },
  {
    id: "verifications",
    title: "Coach Verifications",
    subtitle: "Credential Audit Queue",
    path: "/admin?tab=verifications",
    tab: "verifications",
    Icon: ShieldCheck,
  },
  {
    id: "users",
    title: "User Management",
    subtitle: "Moderation & Suspensions",
    path: "/admin?tab=users",
    tab: "users",
    Icon: Users,
  },
  {
    id: "reports",
    title: "Reports Inbox",
    subtitle: "Coach & Bug Tickets",
    path: "/admin?tab=reports",
    tab: "reports",
    Icon: Flag,
  },
  {
    id: "audit",
    title: "Audit Log",
    subtitle: "Administrative Trail",
    path: "/admin?tab=audit",
    tab: "audit",
    Icon: FileText,
  },
];

export default function MainSidebar() {
  const { user, logout } = useAuth();
  const { theme, previewTheme } = useTheme();
  const activeTheme = previewTheme || theme;
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({});
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [showBugReportModal, setShowBugReportModal] = useState(false);

  const isAdmin = user?.role === "admin" || user?.profile?.role === "admin";

  const activeSectionId = (() => {
    const p = location.pathname;
    const s = location.search;
    if (isAdmin) {
      if (s.includes("tab=verifications")) return "verifications";
      if (s.includes("tab=users")) return "users";
      if (s.includes("tab=reports")) return "reports";
      if (s.includes("tab=audit")) return "audit";
      return "overview";
    }
    if (p === "/" || p.startsWith("/recommend")) return "command";
    if (["/workouts", "/log", "/exercises", "/challenges"].some((s) => p.startsWith(s))) return "training";
    if (["/measurements", "/photos", "/fatigue-check", "/nutrition", "/sleep", "/injuries"].some((s) => p.startsWith(s))) return "biometrics";
    if (p.startsWith("/coach")) return "coaching";
    return "command";
  })();

  useEffect(() => {
    if (user?.id && !isAdmin) {
      api.getDashboardStats().then(setStats).catch(() => {});
      api.getActiveChallenge().then((r) => (r?.active ? setActiveChallenge(r) : null)).catch(() => {});
    }
  }, [user?.id, isAdmin]);

  const userName = user?.name?.split(" ")[0] || user?.nickname || (isAdmin ? "Admin" : "Athlete");

  const userStatus = (() => {
    if (isAdmin) return "Platform Administrator";
    if (user?.role === "coach" || user?.is_coach) return "Coach";

    const level =
      user?.fitness_level ||
      user?.experience ||
      user?.onboarding_data?.fitness_level ||
      user?.onboarding_data?.experience_level ||
      user?.survey_answers?.fitness_level ||
      user?.level;

    if (level && typeof level === "string") {
      return level.charAt(0).toUpperCase() + level.slice(1);
    }
    return "Athlete";
  })();

  return (
    <aside className="main-sidebar-dock">
      {/* ── Brand Logo Header ── */}
      <div className="main-brand-header">
        <div className="main-brand-logo">
          <img
            src="/logo/hpi-logo-transparent.png"
            alt="HPI Logo"
            style={{
              height: 32,
              width: "auto",
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
              WebkitFilter: "brightness(0) invert(1)",
            }}
          />
          <span className="main-brand-pill">
            {isAdmin ? 'ADMIN' : activeTheme === 'monochrome' ? 'PULSE' : activeTheme === 'dark' ? 'DARK' : 'MAIN'}
          </span>
        </div>
        <div className="main-brand-sub">{isAdmin ? "Administration Console" : "Hyper Performance Indicator"}</div>
      </div>

      {/* ── User Profile Mini-Card ── */}
      <div className="main-user-card" onClick={() => navigate(isAdmin ? "/admin" : "/profile")}>
        <div className="main-user-avatar">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={userName} />
          ) : (
            <span>{userName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="main-user-info">
          <div className="main-user-name">{userName}</div>
          <div className="main-user-status">
            <span className="main-dot-live" style={isAdmin ? { background: "#ef4444" } : {}} />
            <span style={isAdmin ? { color: "#f87171", fontWeight: 700 } : {}}>{userStatus}</span>
          </div>
        </div>
        <ArrowUpRight size={14} className="main-arrow-link" />
      </div>

      {/* ── Streak & Rest Day Action (Athletes Only) ── */}
      {!isAdmin && (
        <div className="main-streak-card">
          <div className="main-streak-top">
            <div className="main-streak-count">
              <Flame size={18} color="#0ea5e9" />
              <span>{stats?.current_streak_days || 0} Day Streak</span>
            </div>
            <button
              className="main-rest-btn"
              title="Log Rest Day"
              onClick={async () => {
                try {
                  await api.logRestDay();
                  const newStats = await api.getDashboardStats();
                  setStats(newStats);
                } catch (e) {}
              }}
            >
              <Moon size={12} />
              <span>Rest Day</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Navigation Architecture ── */}
      <nav className="main-nav-list">
        <div className="main-nav-label">{isAdmin ? "ADMINISTRATION" : "SECTIONS"}</div>
        {isAdmin ? (
          ADMIN_SECTIONS.map(({ id, title, subtitle, path, Icon, badge }) => {
            const isActive = activeSectionId === id;
            return (
              <NavLink
                key={id}
                to={path}
                className={`main-nav-item${isActive ? " active" : ""}`}
              >
                <div className="main-nav-item-icon">
                  <Icon size={18} color={isActive ? "#38bdf8" : "#64748b"} />
                </div>
                <div className="main-nav-item-text">
                  <div className="main-nav-item-title">{title}</div>
                  <div className="main-nav-item-sub">{subtitle}</div>
                </div>
                {badge && (
                  <span className="main-nav-item-badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
                    {badge}
                  </span>
                )}
              </NavLink>
            );
          })
        ) : (
          MAIN_SECTIONS.map(({ id, title, subtitle, path, end, Icon, badge }) => {
            const isActive = activeSectionId === id;
            return (
              <NavLink
                key={id}
                to={path}
                end={end}
                className={`main-nav-item${isActive ? " active" : ""}`}
              >
                <div className="main-nav-item-icon">
                  <Icon size={18} color={isActive ? "#0ea5e9" : "#64748b"} />
                </div>
                <div className="main-nav-item-text">
                  <div className="main-nav-item-title">{title}</div>
                  <div className="main-nav-item-sub">{subtitle}</div>
                </div>
                {badge && <span className="main-nav-item-badge">{badge}</span>}
              </NavLink>
            );
          })
        )}
      </nav>

      {/* ── Active Challenge Widget (Athletes Only) ── */}
      {!isAdmin && activeChallenge && (
        <div className="main-challenge-box" onClick={() => navigate("/challenges")}>
          <Trophy size={16} color="#0ea5e9" />
          <div>
            <div className="main-challenge-title">{activeChallenge.challenge_details?.name}</div>
            <div className="main-challenge-sub">
              Day {(activeChallenge.user_challenge?.progress_days?.length || 0) + 1} Goal
            </div>
          </div>
        </div>
      )}

      {/* ── Footer / Controls ── */}
      <div className="main-sidebar-footer">
        <button className="main-icon-btn" onClick={() => setShowBugReportModal(true)} title="Report a Bug">
          <Bug size={16} />
        </button>
        <button className="main-icon-btn" onClick={() => navigate("/profile")} title="Settings">
          <Settings size={16} />
        </button>
        <button
          className="main-icon-btn danger"
          onClick={() => {
            logout();
            navigate("/auth");
          }}
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
        <div className="main-engine-status">
          <Sparkles size={12} color={activeTheme === 'monochrome' ? '#ff3b5c' : '#0ea5e9'} />
          <span>v2.5 {activeTheme === 'monochrome' ? 'Pulse' : activeTheme === 'dark' ? 'Night' : 'Sky'}</span>
        </div>
      </div>

      {showBugReportModal && (
        <ReportBugModal onClose={() => setShowBugReportModal(false)} />
      )}
    </aside>
  );
}
