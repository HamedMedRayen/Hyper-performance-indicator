import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { useTheme } from "../../utils/theme";
import OrbThemeSwitcher from "./OrbThemeSwitcher";
import NotificationCenter from "./NotificationCenter";
import { SUB_NAV } from "./IdentityPanel";
import {
  Compass, Search, LayoutDashboard, Sparkles, Dumbbell, Flame,
  BookOpen, Trophy, Dna, Utensils, Moon, Activity, Camera,
  ShieldAlert, Users, Calendar, ChevronRight, X, ShieldCheck, Flag, FileText
} from "lucide-react";

/* ── Global Search Sections Database ── */
const SEARCH_DATABASE = [
  {
    category: "Command & AI",
    items: [
      { label: "Dashboard", sub: "Main Overview & Stats", path: "/", Icon: LayoutDashboard },
      { label: "AI Recommendations", sub: "Personalized Training & Diet", path: "/recommend", Icon: Sparkles },
    ],
  },
  {
    category: "Training & Performance",
    items: [
      { label: "Workouts & Sessions", sub: "All Saved Routines", path: "/workouts", Icon: Dumbbell },
      { label: "Log Workout", sub: "Track Reps, Sets & Volume", path: "/log", Icon: Flame },
      { label: "Exercise Library", sub: "Technique & Muscle Guides", path: "/exercises", Icon: BookOpen },
      { label: "Active Challenges", sub: "Community Goals & Badges", path: "/challenges", Icon: Trophy },
    ],
  },
  {
    category: "Biometrics & Health",
    items: [
      { label: "Body Measurements", sub: "Weight, Body Fat & Circumferences", path: "/measurements", Icon: Dna },
      { label: "Nutrition & Meals", sub: "Macronutrients & Calorie Tracking", path: "/nutrition", Icon: Utensils },
      { label: "Sleep Tracker", sub: "Sleep Quality & Recovery", path: "/sleep", Icon: Moon },
      { label: "Fatigue Check", sub: "CNS Fatigue & Readiness Score", path: "/fatigue-check", Icon: Activity },
      { label: "Progress Photos", sub: "Visual Transformation Gallery", path: "/photos", Icon: Camera },
      { label: "Injury Log", sub: "Pain Tracking & Rehabilitation", path: "/injuries", Icon: ShieldAlert },
    ],
  },
  {
    category: "Coach Zone",
    items: [
      { label: "Coach Directory", sub: "Find Certified Trainers", path: "/coach", Icon: Users },
      { label: "Community Events", sub: "Live Workshops & Masterclasses", path: "/coach/events", Icon: Calendar },
    ],
  },
];

const ADMIN_SEARCH_DATABASE = [
  {
    category: "Admin Management",
    items: [
      { label: "Admin Overview", sub: "System Metrics & Analytics", path: "/admin", Icon: LayoutDashboard },
      { label: "Coach Verifications", sub: "Review & Audit Credentials", path: "/admin?tab=verifications", Icon: ShieldCheck },
      { label: "User Management", sub: "Moderation & Suspensions", path: "/admin?tab=users", Icon: Users },
      { label: "Reports Inbox", sub: "Coach & Bug Reports", path: "/admin?tab=reports", Icon: Flag },
      { label: "Audit Log", sub: "Administrative Actions Trail", path: "/admin?tab=audit", Icon: FileText },
    ],
  },
];

const ADMIN_CHIPS = [
  { label: "Overview", path: "/admin", tab: "overview" },
  { label: "Coach Verifications", path: "/admin?tab=verifications", tab: "verifications" },
  { label: "User Management", path: "/admin?tab=users", tab: "users" },
  { label: "Reports Inbox", path: "/admin?tab=reports", tab: "reports" },
  { label: "Audit Log", path: "/admin?tab=audit", tab: "audit" },
];

export default function MainHeader() {
  const { user } = useAuth();
  const { theme, previewTheme } = useTheme();
  const activeTheme = previewTheme || theme;
  const iconColor = activeTheme === 'monochrome' ? '#ffffff' : activeTheme === 'dark' ? '#38bdf8' : '#0ea5e9';
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchContainerRef = useRef(null);

  const isAdmin = user?.role === "admin" || user?.profile?.role === "admin";

  // Determine current active section & subnav chips
  const activeSectionKey = (() => {
    if (isAdmin) return "admin";
    const p = location.pathname;
    if (p === "/" || p.startsWith("/recommend")) return "command";
    if (["/workouts", "/log", "/exercises", "/challenges"].some((s) => p.startsWith(s))) return "performance";
    if (["/measurements", "/photos", "/fatigue-check", "/nutrition", "/sleep", "/injuries"].some((s) => p.startsWith(s))) return "biometrics";
    if (p.startsWith("/coach")) return "coaching";
    return "command";
  })();

  const chips = isAdmin ? ADMIN_CHIPS : (SUB_NAV[activeSectionKey] || []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleSelectResult = (path) => {
    navigate(path);
    setQuery("");
    setIsOpen(false);
  };

  const activeDatabase = isAdmin ? ADMIN_SEARCH_DATABASE : SEARCH_DATABASE;

  // Filter sections by search query
  const filteredSections = activeDatabase.map((sec) => {
    const matchingItems = sec.items.filter(
      (item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.sub.toLowerCase().includes(query.toLowerCase())
    );
    return { ...sec, items: matchingItems };
  }).filter((sec) => sec.items.length > 0);

  return (
    <header className="main-header-bar">
      <div className="main-header-left">
        {/* Active Section Indicator */}
        <div className="main-section-badge">
          <Compass size={14} color={iconColor} />
          <span className="main-section-badge-text">
            {isAdmin
              ? "Platform Administration"
              : activeSectionKey === "command"
              ? "Command Center"
              : activeSectionKey === "performance"
              ? "Training Hub"
              : activeSectionKey === "biometrics"
              ? "Biometrics & Health"
              : "Coach Zone"}
          </span>
        </div>

        {/* Sub-Navigation Chips */}
        <div className="main-chips-row">
          {chips.map((chip) => {
            const isActive = isAdmin
              ? (chip.tab === "overview" && (!location.search || location.search.includes("tab=overview"))) ||
                (location.search && location.search.includes(`tab=${chip.tab}`))
              : chip.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(chip.path);
            return (
              <NavLink
                key={chip.path}
                to={chip.path}
                className={`main-chip${isActive ? " active" : ""}`}
              >
                {chip.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      <div className="main-header-right">
        {/* Interactive Search Bar & Autocomplete Dropdown */}
        <div className="main-search-wrapper" ref={searchContainerRef}>
          <div className="main-search-pill">
            <Search size={14} color={iconColor} style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search sections & apps..."
              className="main-search-input"
              style={{
                border: "none",
                outline: "none",
                boxShadow: "none",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 500,
                width: "100%",
                padding: 0,
                margin: 0,
                color: "inherit",
              }}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
            />
            {query && (
              <button
                className="main-search-clear"
                onClick={() => {
                  setQuery("");
                  setIsOpen(false);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Search Autocomplete Dropdown Menu */}
          {isOpen && (
            <div className="main-search-dropdown">
              {filteredSections.length > 0 ? (
                filteredSections.map((sec) => (
                  <div key={sec.category} className="main-search-section">
                    <div className="main-search-category-title">{sec.category}</div>
                    <div className="main-search-items-list">
                      {sec.items.map((item) => (
                        <div
                          key={item.path}
                          className="main-search-item"
                          onClick={() => handleSelectResult(item.path)}
                        >
                          <div className="main-search-item-icon">
                            <item.Icon size={16} color={iconColor} />
                          </div>
                          <div className="main-search-item-info">
                            <div className="main-search-item-label">{item.label}</div>
                            <div className="main-search-item-sub">{item.sub}</div>
                          </div>
                          <ChevronRight size={14} className="main-search-item-arrow" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="main-search-no-results">
                  No matching sections found for "{query}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications Center */}
        <div className="main-notif-wrapper" style={{ display: "flex", alignItems: "center" }}>
          <NotificationCenter />
        </div>

        {/* Orb Theme Switcher */}
        <div className="main-orb-wrapper">
          <OrbThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
