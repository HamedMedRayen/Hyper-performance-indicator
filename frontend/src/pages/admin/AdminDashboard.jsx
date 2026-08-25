import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutDashboard, ShieldCheck, Users, Flag, FileText, Shield } from "lucide-react";
import AdminOverview from "./AdminOverview";
import CoachVerificationQueue from "./CoachVerificationQueue";
import UserManagement from "./UserManagement";
import ReportsInbox from "./ReportsInbox";
import AuditLog from "./AuditLog";

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "verifications", label: "Coach Verifications", icon: ShieldCheck },
    { id: "users", label: "User Management", icon: Users },
    { id: "reports", label: "Reports Inbox", icon: Flag },
    { id: "audit", label: "Audit Log", icon: FileText }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%", paddingBottom: 24 }}>
      {/* Top Admin Command Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          padding: "10px 16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ef4444"
            }}
          >
            <Shield size={16} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>Admin Portal</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>System Management & Moderation</div>
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: isActive ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid transparent",
                  background: isActive ? "rgba(14, 165, 233, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  color: isActive ? "#38bdf8" : "#94a3b8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                <Icon size={15} color={isActive ? "#38bdf8" : "#64748b"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Admin View Content */}
      <main style={{ minWidth: 0, width: "100%" }}>
        {activeTab === "overview" && <AdminOverview setActiveTab={handleTabChange} />}
        {activeTab === "verifications" && <CoachVerificationQueue />}
        {activeTab === "users" && <UserManagement />}
        {activeTab === "reports" && <ReportsInbox />}
        {activeTab === "audit" && <AuditLog />}
      </main>
    </div>
  );
}
