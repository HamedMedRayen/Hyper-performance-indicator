import React, { useState, useEffect } from "react";
import { Flag, Bug, CheckCircle, XCircle, Eye, ExternalLink, MessageSquare, Send, UserX, Clock, ShieldAlert, AlertTriangle, X } from "lucide-react";
import { admin } from "../../utils/api";

export default function ReportsInbox() {
  const [activeType, setActiveType] = useState("coach"); // "coach" or "bug"
  const [statusFilter, setStatusFilter] = useState("open");
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);
  const [actionTab, setActionTab] = useState("suspend"); // "suspend" | "inquiry" | "resolve"
  const [adminNotes, setAdminNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Reach out to coach state
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  // Suspend coach state
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendType, setSuspendType] = useState("temporary"); // "temporary" or "indefinite"
  const [suspendDurationDays, setSuspendDurationDays] = useState(7);
  const [suspendCustomDate, setSuspendCustomDate] = useState("");
  const [suspendLoading, setSuspendLoading] = useState(false);

  const handleSelectReport = (row) => {
    setSelectedReport(row);
    setActionTab(row.report_type === "coach" && row.status === "open" ? "suspend" : "resolve");
    setSuspendReason(`Report #${row.id}: ${row.category} - ${row.description?.slice(0, 80) || ""}`);
    setContactSubject(`Inquiry regarding Report #${row.id} (${row.category})`);
    setContactMessage(`Hello ${row.target_user_name || "Coach"},\n\nWe have received a report regarding "${row.category}". Before taking any administrative measures, we would like to hear your perspective.\n\nPlease reply to this administrative notice.\n\n— HPI Platform Administration`);
  };

  const loadReports = async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await admin.getReports(activeType, statusFilter, page, 20);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(1);
  }, [activeType, statusFilter]);

  const handleSendCoachInquiry = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      alert("Please provide both a subject and message for the coach.");
      return;
    }
    setContactLoading(true);
    try {
      const res = await admin.contactCoachReport(selectedReport.id, contactSubject.trim(), contactMessage.trim());
      alert(res.message || "Inquiry sent successfully to the coach.");
      if (res.report) {
        setSelectedReport(res.report);
      }
      setActionTaken(`Dispatched administrative inquiry to coach on ${new Date().toLocaleDateString()}`);
      loadReports(data.page);
    } catch (err) {
      alert(err.message || "Failed to send inquiry to coach.");
    } finally {
      setContactLoading(false);
    }
  };

  const handleSuspendCoach = async () => {
    if (!suspendReason.trim()) {
      alert("Please provide a reason for suspending this coach.");
      return;
    }
    setSuspendLoading(true);
    try {
      let durationDays = null;
      let untilDate = null;
      if (suspendType === "temporary") {
        if (suspendDurationDays === -1) {
          if (!suspendCustomDate) {
            alert("Please select a valid custom date.");
            setSuspendLoading(false);
            return;
          }
          untilDate = new Date(suspendCustomDate).toISOString();
        } else {
          durationDays = Number(suspendDurationDays);
        }
      }

      await admin.suspendUser(
        selectedReport.target_user_id,
        suspendReason.trim(),
        durationDays,
        untilDate
      );
      alert(`Coach has been ${suspendType === "temporary" ? "temporarily suspended" : "suspended indefinitely"}.`);
      setActionTaken(`Suspended coach profile (${suspendType === 'temporary' ? (durationDays ? `${durationDays} days` : `until ${suspendCustomDate}`) : 'Indefinite'})`);
      setActionTab("resolve");
      loadReports(data.page);
    } catch (err) {
      alert(err.message || "Failed to suspend coach.");
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!adminNotes.trim()) {
      alert("Please provide admin notes explaining the resolution.");
      return;
    }
    setActionLoading(true);
    try {
      await admin.resolveReport(selectedReport.id, adminNotes.trim(), actionTaken.trim() || null);
      setSelectedReport(null);
      setAdminNotes("");
      setActionTaken("");
      loadReports(data.page);
    } catch (err) {
      alert(err.message || "Failed to resolve report");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!adminNotes.trim()) {
      alert("Please provide admin notes explaining why the report was dismissed.");
      return;
    }
    setActionLoading(true);
    try {
      await admin.dismissReport(selectedReport.id, adminNotes.trim());
      setSelectedReport(null);
      setAdminNotes("");
      setActionTaken("");
      loadReports(data.page);
    } catch (err) {
      alert(err.message || "Failed to dismiss report");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>Reports Inbox</h2>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Review and resolve user coach reports and software bug tickets</div>
        </div>

        {/* Status & Type Filter Pills */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Type Selector */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255, 255, 255, 0.05)", padding: 4, borderRadius: 12 }}>
            <button
              onClick={() => setActiveType("coach")}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: activeType === "coach" ? "rgba(239, 68, 68, 0.2)" : "transparent",
                color: activeType === "coach" ? "#f87171" : "#94a3b8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Flag size={14} /> Coach Reports
            </button>
            <button
              onClick={() => setActiveType("bug")}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: activeType === "bug" ? "rgba(14, 165, 233, 0.2)" : "transparent",
                color: activeType === "bug" ? "#38bdf8" : "#94a3b8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Bug size={14} /> Bug Reports
            </button>
          </div>

          {/* Status Selector */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255, 255, 255, 0.05)", padding: 4, borderRadius: 12 }}>
            {["open", "resolved", "dismissed", ""].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: statusFilter === st ? "rgba(255, 255, 255, 0.15)" : "transparent",
                  color: statusFilter === st ? "#fff" : "#94a3b8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "capitalize"
                }}
              >
                {st || "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Reports Table */}
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
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Reporter</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Category</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Target / Context</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Submitted</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Loading reports...</td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#64748b" }}>
                  No {activeType} reports found with status '{statusFilter || "all"}'.
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedReport(row)}
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    cursor: "pointer",
                    background: selectedReport?.id === row.id ? "rgba(14, 165, 233, 0.08)" : "transparent"
                  }}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, color: "#fff" }}>{row.reporter_name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{row.reporter_email}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{row.category}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>
                    {row.report_type === "coach" ? (
                      <span style={{ color: "#c084fc", fontWeight: 700 }}>Coach: {row.target_user_name || `ID #${row.target_user_id}`}</span>
                    ) : (
                      <span>{row.app_context || "Global App"}</span>
                    )}
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
                          row.status === "resolved"
                            ? "rgba(34, 197, 94, 0.15)"
                            : row.status === "dismissed"
                            ? "rgba(100, 116, 139, 0.2)"
                            : "rgba(239, 68, 68, 0.15)",
                        color:
                          row.status === "resolved"
                            ? "#4ade80"
                            : row.status === "dismissed"
                            ? "#94a3b8"
                            : "#f87171"
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>
                    {row.created_at ? new Date(row.created_at).toLocaleDateString() : "N/A"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedReport(row)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "none",
                        color: "#38bdf8",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Eye size={14} /> Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Side-by-Side Report Review & Action Suite Modal */}
      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)} style={{ zIndex: 9999 }}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 1040,
              width: "95%",
              maxHeight: "88vh",
              overflowY: "auto",
              padding: 24,
              borderRadius: 20,
              background: "rgba(15, 23, 42, 0.98)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: selectedReport.report_type === "coach" ? "rgba(168, 85, 247, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    border: selectedReport.report_type === "coach" ? "1px solid rgba(168, 85, 247, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: selectedReport.report_type === "coach" ? "#c084fc" : "#f87171"
                  }}
                >
                  {selectedReport.report_type === "coach" ? <Flag size={18} /> : <Bug size={18} />}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Report #{selectedReport.id}</h3>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        background: selectedReport.status === "resolved" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: selectedReport.status === "resolved" ? "#4ade80" : "#f87171"
                      }}
                    >
                      {selectedReport.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {selectedReport.category} • Submitted {new Date(selectedReport.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Side-by-Side Content Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 1fr",
                gap: 20,
                alignItems: "start"
              }}
            >
              {/* LEFT COLUMN: Report Details & Context */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: 12, background: "rgba(255, 255, 255, 0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Reporter: <strong style={{ color: "#fff" }}>{selectedReport.reporter_name}</strong> ({selectedReport.reporter_email})
                  </div>
                  {selectedReport.report_type === "coach" && (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      Reported Coach: <strong style={{ color: "#c084fc" }}>{selectedReport.target_user_name || `ID #${selectedReport.target_user_id}`}</strong>
                    </div>
                  )}
                  {selectedReport.app_context && (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      Context: <strong style={{ color: "#38bdf8" }}>{selectedReport.app_context}</strong>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div style={{ padding: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
                    Report Description
                  </div>
                  <div style={{ fontSize: 13, color: "#f1f5f9", whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 200, overflowY: "auto" }}>
                    {selectedReport.description}
                  </div>
                </div>

                {/* Screenshot (if attached) */}
                {selectedReport.screenshot_url && (
                  <div style={{ padding: 10, background: "rgba(255, 255, 255, 0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
                      Attached Evidence
                    </div>
                    <a href={selectedReport.screenshot_url} target="_blank" rel="noreferrer">
                      <img
                        src={selectedReport.screenshot_url}
                        alt="Evidence"
                        style={{ width: "100%", maxHeight: 150, objectFit: "contain", borderRadius: 8, background: "#000" }}
                      />
                    </a>
                  </div>
                )}

                {/* Inquiry History Banner */}
                {selectedReport.inquiry_sent && (
                  <div style={{ padding: 10, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 10, color: "#fbbf24", fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, marginBottom: 2 }}>
                      <MessageSquare size={14} /> Official Inquiry Dispatched
                    </div>
                    <div style={{ color: "#fef3c7", lineHeight: 1.4 }}>{selectedReport.inquiry_notes}</div>
                    {selectedReport.inquiry_at && (
                      <div style={{ fontSize: 10, color: "rgba(251, 191, 36, 0.8)", marginTop: 4 }}>
                        Sent: {new Date(selectedReport.inquiry_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Coach Statement / Reply Banner */}
                {selectedReport.inquiry_reply && (
                  <div style={{ padding: 10, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.35)", borderRadius: 10, color: "#34d399", fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, marginBottom: 3 }}>
                      <CheckCircle size={14} /> Coach Statement Received
                    </div>
                    <div style={{ color: "#ecfdf5", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                      "{selectedReport.inquiry_reply}"
                    </div>
                    {selectedReport.inquiry_reply_at && (
                      <div style={{ fontSize: 10, color: "rgba(52, 211, 153, 0.8)", marginTop: 4 }}>
                        Replied on: {new Date(selectedReport.inquiry_reply_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Existing Admin Notes */}
                {selectedReport.admin_notes && (
                  <div style={{ padding: 10, background: "rgba(14, 165, 233, 0.12)", borderRadius: 10, color: "#38bdf8", fontSize: 12 }}>
                    <strong>Admin Notes:</strong> {selectedReport.admin_notes}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Side-by-Side Suspension & Actions */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                {/* Action Mode Switcher */}
                <div style={{ display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 10 }}>
                  {selectedReport.report_type === "coach" && selectedReport.status === "open" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActionTab("suspend")}
                        style={{
                          flex: 1,
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: actionTab === "suspend" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid transparent",
                          background: actionTab === "suspend" ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.04)",
                          color: actionTab === "suspend" ? "#f87171" : "#94a3b8",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4
                        }}
                      >
                        <UserX size={13} /> Suspend Coach
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionTab("inquiry")}
                        style={{
                          flex: 1,
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: actionTab === "inquiry" ? "1px solid rgba(14, 165, 233, 0.4)" : "1px solid transparent",
                          background: actionTab === "inquiry" ? "rgba(14, 165, 233, 0.2)" : "rgba(255,255,255,0.04)",
                          color: actionTab === "inquiry" ? "#38bdf8" : "#94a3b8",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4
                        }}
                      >
                        <MessageSquare size={13} /> Reach Out
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setActionTab("resolve")}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: actionTab === "resolve" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
                      background: actionTab === "resolve" ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.04)",
                      color: actionTab === "resolve" ? "#34d399" : "#94a3b8",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}
                  >
                    <CheckCircle size={13} /> Resolve / Close
                  </button>
                </div>

                {/* TAB 1: SIDE-BY-SIDE SUSPEND COACH */}
                {actionTab === "suspend" && selectedReport.report_type === "coach" && selectedReport.status === "open" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#f87171", display: "flex", alignItems: "center", gap: 6 }}>
                        <ShieldAlert size={15} /> Suspend Coach Account
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Hide profile from discovery and pause athlete booking privileges.
                      </div>
                    </div>

                    {/* Suspension Type Toggle */}
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                        Duration Type
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setSuspendType("temporary")}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "none",
                            background: suspendType === "temporary" ? "rgba(14, 165, 233, 0.25)" : "rgba(255,255,255,0.05)",
                            color: suspendType === "temporary" ? "#38bdf8" : "#94a3b8",
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4
                          }}
                        >
                          <Clock size={12} /> Temporary
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuspendType("indefinite")}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "none",
                            background: suspendType === "indefinite" ? "rgba(239, 68, 68, 0.25)" : "rgba(255,255,255,0.05)",
                            color: suspendType === "indefinite" ? "#f87171" : "#94a3b8",
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4
                          }}
                        >
                          <UserX size={12} /> Indefinite
                        </button>
                      </div>
                    </div>

                    {/* Duration Preset Selector */}
                    {suspendType === "temporary" && (
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
                          Select Period
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 4 }}>
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
                                padding: "5px 2px",
                                borderRadius: 6,
                                border: "none",
                                background: suspendDurationDays === opt.days ? "rgba(14, 165, 233, 0.3)" : "rgba(255,255,255,0.05)",
                                color: suspendDurationDays === opt.days ? "#38bdf8" : "#94a3b8",
                                fontSize: 10,
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
                              padding: 6,
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              color: "#fff",
                              fontSize: 12,
                              outline: "none"
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Suspension Reason Input */}
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 3 }}>
                        Reason for Suspension *
                      </label>
                      <textarea
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        rows={2}
                        placeholder="Violation rationale to notify the coach..."
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                          fontSize: 12,
                          outline: "none",
                          resize: "none"
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSuspendCoach}
                      disabled={suspendLoading}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        border: "none",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6
                      }}
                    >
                      <UserX size={14} /> {suspendLoading ? "Applying Suspension..." : "Apply Coach Suspension"}
                    </button>
                  </div>
                )}

                {/* TAB 2: SIDE-BY-SIDE INQUIRY */}
                {actionTab === "inquiry" && selectedReport.report_type === "coach" && selectedReport.status === "open" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
                        <MessageSquare size={15} /> Administrative Inquiry Notice
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Reach out directly to {selectedReport.target_user_name || "Coach"} before issuing suspensions.
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 3 }}>Subject *</label>
                      <input
                        type="text"
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        style={{
                          width: "100%",
                          padding: 7,
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                          fontSize: 12,
                          outline: "none"
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 3 }}>Message Content *</label>
                      <textarea
                        rows={4}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        style={{
                          width: "100%",
                          padding: 7,
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                          fontSize: 12,
                          outline: "none",
                          resize: "none"
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSendCoachInquiry}
                      disabled={contactLoading}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                        border: "none",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6
                      }}
                    >
                      <Send size={14} /> {contactLoading ? "Dispatching..." : "Send Official Inquiry"}
                    </button>
                  </div>
                )}

                {/* TAB 3: RESOLVE / DISMISS */}
                {actionTab === "resolve" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle size={15} /> Resolve or Dismiss Report
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Provide administrative notes for the resolution audit record.
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 3 }}>Admin Notes *</label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={3}
                        placeholder="Explain action taken or rationale for dismissal..."
                        style={{
                          width: "100%",
                          padding: 7,
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                          fontSize: 12,
                          outline: "none",
                          resize: "none"
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 3 }}>Action Summary (Optional)</label>
                      <input
                        type="text"
                        value={actionTaken}
                        onChange={(e) => setActionTaken(e.target.value)}
                        placeholder="e.g. Issued 7-day suspension, contacted coach..."
                        style={{
                          width: "100%",
                          padding: 7,
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                          fontSize: 12,
                          outline: "none"
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                      <button
                        type="button"
                        onClick={handleDismiss}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: 8,
                          background: "rgba(100, 116, 139, 0.2)",
                          border: "1px solid rgba(100, 116, 139, 0.4)",
                          color: "#cbd5e1",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={handleResolve}
                        disabled={actionLoading}
                        style={{
                          flex: 1.2,
                          padding: "7px 12px",
                          borderRadius: 8,
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          border: "none",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        Resolve & Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
