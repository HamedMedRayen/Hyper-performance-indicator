import React, { useState, useEffect } from "react";
import { Search, UserX, UserCheck, Shield, AlertTriangle, RefreshCw, MessageSquare, Send, Clock, ShieldAlert, X } from "lucide-react";
import { admin } from "../../utils/api";

export default function UserManagement() {
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendType, setSuspendType] = useState("temporary"); // "temporary" or "indefinite"
  const [suspendDurationDays, setSuspendDurationDays] = useState(7);
  const [suspendCustomDate, setSuspendCustomDate] = useState("");
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Reach out / Message modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const loadUsers = async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await admin.getUsers(roleFilter, searchQuery, statusFilter, page, 20);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load users list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [roleFilter, statusFilter, searchQuery]);

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      alert("Please provide a reason for suspending this user.");
      return;
    }
    setActionLoading(true);
    try {
      let durationDays = null;
      let untilDate = null;
      if (suspendType === "temporary") {
        if (suspendDurationDays === -1) {
          if (!suspendCustomDate) {
            alert("Please select a valid custom date.");
            setActionLoading(false);
            return;
          }
          untilDate = new Date(suspendCustomDate).toISOString();
        } else {
          durationDays = Number(suspendDurationDays);
        }
      }

      await admin.suspendUser(
        selectedUser.id,
        suspendReason.trim(),
        durationDays,
        untilDate
      );
      setShowSuspendModal(false);
      setSuspendReason("");
      setSelectedUser(null);
      loadUsers(data.page);
    } catch (err) {
      alert(err.message || "Failed to suspend user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenContact = (user) => {
    setSelectedUser(user);
    setContactSubject(`Administrative Notice for ${user.name}`);
    setContactMessage(`Hello ${user.name},\n\nThis is an official communication from HPI Administration regarding your account.\n\n`);
    setShowContactModal(true);
  };

  const handleSendMessage = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      alert("Please provide both subject and message.");
      return;
    }
    setContactLoading(true);
    try {
      await admin.contactUser(selectedUser.id, contactSubject.trim(), contactMessage.trim());
      alert(`Message dispatched to ${selectedUser.name}.`);
      setShowContactModal(false);
    } catch (err) {
      alert(err.message || "Failed to send message.");
    } finally {
      setContactLoading(false);
    }
  };

  const handleReinstate = async (user) => {
    if (!window.confirm(`Reinstate access for ${user.name}?`)) return;
    setActionLoading(true);
    try {
      await admin.reinstateUser(user.id);
      loadUsers(data.page);
    } catch (err) {
      alert(err.message || "Failed to reinstate user");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>User Management</h2>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Search, moderate, and manage user permissions</div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Search Box */}
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "#64748b" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or email..."
              style={{
                padding: "8px 14px 8px 36px",
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#fff",
                fontSize: 13,
                outline: "none",
                width: 220
              }}
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              fontSize: 13,
              outline: "none"
            }}
          >
            <option value="" style={{ background: "#0f172a" }}>All Roles</option>
            <option value="athlete" style={{ background: "#0f172a" }}>Athlete</option>
            <option value="coach" style={{ background: "#0f172a" }}>Coach</option>
            <option value="admin" style={{ background: "#0f172a" }}>Admin</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              fontSize: 13,
              outline: "none"
            }}
          >
            <option value="" style={{ background: "#0f172a" }}>All Statuses</option>
            <option value="active" style={{ background: "#0f172a" }}>Active</option>
            <option value="suspended" style={{ background: "#0f172a" }}>Suspended</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Users Table */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          overflow: "hidden"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, color: "#cbd5e1" }}>
          <thead>
            <tr style={{ background: "rgba(255, 255, 255, 0.04)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>User</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Role</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Joined</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Loading users...</td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#64748b" }}>No users match the criteria.</td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "#fff"
                        }}
                      >
                        {row.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{row.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{row.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        background:
                          row.role === "admin"
                            ? "rgba(239, 68, 68, 0.2)"
                            : row.role === "coach"
                            ? "rgba(168, 85, 247, 0.2)"
                            : "rgba(14, 165, 233, 0.2)",
                        color:
                          row.role === "admin"
                            ? "#ef4444"
                            : row.role === "coach"
                            ? "#c084fc"
                            : "#38bdf8"
                      }}
                    >
                      {row.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {row.is_suspended ? (
                      <div>
                        <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          <UserX size={14} /> Suspended
                        </span>
                        {row.suspended_until ? (
                          <div style={{ fontSize: 11, color: "#f59e0b", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                            <Clock size={11} /> until {new Date(row.suspended_until).toLocaleDateString()}
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Indefinite</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "#10b981", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <UserCheck size={14} /> Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>
                    {row.created_at ? new Date(row.created_at).toLocaleDateString() : "N/A"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {row.role === "admin" ? (
                      <span style={{ fontSize: 11, color: "#64748b" }}>Protected</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handleOpenContact(row)}
                          title="Reach out / Send notification"
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: "rgba(14, 165, 233, 0.15)",
                            border: "1px solid rgba(14, 165, 233, 0.3)",
                            color: "#38bdf8",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <MessageSquare size={13} /> Reach Out
                        </button>

                        {row.is_suspended ? (
                          <button
                            onClick={() => handleReinstate(row)}
                            disabled={actionLoading}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              background: "rgba(16, 185, 129, 0.2)",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                              color: "#34d399",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            Reinstate
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedUser(row);
                              setShowSuspendModal(true);
                            }}
                            disabled={actionLoading}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              background: "rgba(239, 68, 68, 0.15)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#f87171",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Suspend Reason Modal */}
      {showSuspendModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowSuspendModal(false)} style={{ zIndex: 10000 }}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: "90%",
              padding: 24,
              borderRadius: 20,
              background: "rgba(15, 23, 42, 0.98)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fff"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShieldAlert size={20} color="#f87171" />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Suspend User Account</h3>
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>
              Are you sure you want to suspend <strong>{selectedUser.name}</strong> ({selectedUser.email})?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type Toggle */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                  Suspension Duration Type
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSuspendType("temporary")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: suspendType === "temporary" ? "rgba(14, 165, 233, 0.25)" : "rgba(255,255,255,0.05)",
                      color: suspendType === "temporary" ? "#38bdf8" : "#94a3b8",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <Clock size={14} /> Temporary Suspension
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuspendType("indefinite")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: suspendType === "indefinite" ? "rgba(239, 68, 68, 0.25)" : "rgba(255,255,255,0.05)",
                      color: suspendType === "indefinite" ? "#f87171" : "#94a3b8",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <UserX size={14} /> Indefinite
                  </button>
                </div>
              </div>

              {/* Temporary Selector */}
              {suspendType === "temporary" && (
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                    Select Duration
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8 }}>
                    {[
                      { label: "24 Hours", days: 1 },
                      { label: "3 Days", days: 3 },
                      { label: "7 Days", days: 7 },
                      { label: "14 Days", days: 14 },
                      { label: "30 Days", days: 30 },
                      { label: "Custom Date", days: -1 }
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setSuspendDurationDays(opt.days)}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: "none",
                          background: suspendDurationDays === opt.days ? "rgba(14, 165, 233, 0.3)" : "rgba(255,255,255,0.05)",
                          color: suspendDurationDays === opt.days ? "#38bdf8" : "#94a3b8",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {suspendDurationDays === -1 && (
                    <input
                      type="date"
                      value={suspendCustomDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setSuspendCustomDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        fontSize: 13,
                        outline: "none"
                      }}
                    />
                  )}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                  Reason for Suspension *
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={3}
                  placeholder="Reason for suspension (terms violation, abusive behavior...)"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  onClick={() => setShowSuspendModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    color: "#cbd5e1",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={actionLoading}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    border: "none",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {actionLoading ? "Processing..." : "Confirm Suspension"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reach Out / Send Message Modal ── */}
      {showContactModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)} style={{ zIndex: 10000 }}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 500,
              width: "90%",
              padding: 24,
              borderRadius: 20,
              background: "rgba(15, 23, 42, 0.98)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(14, 165, 233, 0.3)",
              color: "#fff"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Administrative Notice</h3>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 14px 0" }}>
              Send an official notification to <strong style={{ color: "#fff" }}>{selectedUser.name}</strong> ({selectedUser.email}).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                  Subject *
                </label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                  Message Content *
                </label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={5}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => setShowContactModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    background: "rgba(100, 116, 139, 0.2)",
                    border: "1px solid rgba(100, 116, 139, 0.4)",
                    color: "#cbd5e1",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={contactLoading}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                    border: "none",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Send size={14} /> {contactLoading ? "Sending..." : "Dispatch Message"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
