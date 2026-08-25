import React, { useState, useEffect } from "react";
import { api, reports } from "../../utils/api";
import { Bell, CheckCircle, X, Dumbbell, AlertCircle, Plus, ChevronRight, MessageSquare, Send, ShieldAlert, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    setOpen(!open);
    if (!open) {
      fetchNotifications();
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteNotification(id);
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddWorkout = async (notification) => {
    try {
      const programName = notification.data.program_name || "Suggested Program";
      const workouts = notification.data.workouts || [];

      for (const w of workouts) {
        const templateData = {
          name: `${programName} - ${w.name}`,
          exercises: w.exercises
        };
        await api.saveTemplate(templateData);
      }

      await api.markNotificationRead(notification.id);
      fetchNotifications();
      navigate('/workouts');
    } catch (e) {
      console.error("Failed to save templates", e);
    }
  };

  const handleSendReply = async (n) => {
    const reportId = n.data?.report_id;
    if (!reportId) {
      alert("Report reference not found for this inquiry notice.");
      return;
    }
    if (!replyText.trim()) {
      alert("Please enter your perspective or reply.");
      return;
    }
    setReplyLoading(true);
    try {
      const res = await reports.replyToInquiry(reportId, replyText.trim());
      alert(res.message || "Your official reply has been submitted to platform administration.");
      setReplyingId(null);
      setReplyText("");
      fetchNotifications();
    } catch (err) {
      alert(err.message || "Failed to submit response to administration.");
    } finally {
      setReplyLoading(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleToggle}
        title="Notifications"
        style={{
          background: open ? "rgba(14, 165, 233, 0.25)" : "rgba(255, 255, 255, 0.06)",
          border: open ? "1px solid rgba(14, 165, 233, 0.5)" : "1px solid rgba(255, 255, 255, 0.12)",
          position: "relative",
          cursor: "pointer",
          width: 36,
          height: 36,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: open ? "#38bdf8" : "#cbd5e1",
          transition: "all 0.2s"
        }}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <div style={{
            position: "absolute", top: -3, right: -3, background: "#ef4444",
            color: "white", fontSize: 10, fontWeight: 900, minWidth: 17, height: 17,
            borderRadius: 9, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 2px #0f172a"
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </button>

      {open && (
        <>
          {/* Global click-outside backdrop with top z-index */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 99998 }}
          />

          {/* Floating Dropdown Container with highest z-index */}
          <div style={{
            position: "absolute", top: "calc(100% + 12px)", right: 0,
            width: 360,
            background: "rgba(15, 23, 42, 0.98)",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: 18,
            boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
            zIndex: 99999,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: 460,
            color: "#fff"
          }}>
            {/* Header */}
            <div style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.03)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={16} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff" }}>Notifications</h3>
                {unreadCount > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(14, 165, 233, 0.2)", color: "#38bdf8", padding: "2px 7px", borderRadius: 6 }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Notifications List */}
            <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  <Bell size={26} style={{ margin: "0 auto 8px", display: "block", color: "#475569" }} />
                  No notifications yet
                </div>
              ) : (
                notifications.map(n => {
                  const isInquiry = n.type === 'admin_inquiry';
                  const isCoachReply = n.type === 'coach_inquiry_reply';
                  const isSuspension = n.type === 'account_suspension';
                  
                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        background: isInquiry ? "rgba(245, 158, 11, 0.06)" : n.is_read ? "transparent" : "rgba(14, 165, 233, 0.06)",
                        display: "flex", gap: 12, alignItems: "flex-start",
                        transition: "background 0.2s"
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: isInquiry
                          ? 'rgba(245, 158, 11, 0.2)'
                          : isCoachReply
                          ? 'rgba(16, 185, 129, 0.2)'
                          : isSuspension
                          ? 'rgba(239, 68, 68, 0.2)'
                          : n.type === 'workout_suggestion'
                          ? 'rgba(14, 165, 233, 0.2)'
                          : 'rgba(255,255,255,0.06)',
                        color: isInquiry
                          ? '#fbbf24'
                          : isCoachReply
                          ? '#34d399'
                          : isSuspension
                          ? '#f87171'
                          : n.type === 'workout_suggestion'
                          ? '#38bdf8'
                          : '#cbd5e1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isInquiry ? <ShieldAlert size={16} /> : isCoachReply ? <MessageSquare size={16} /> : isSuspension ? <ShieldAlert size={16} /> : n.type === 'workout_suggestion' ? <Dumbbell size={16} /> : <AlertCircle size={16} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                          <div style={{ fontSize: 13, fontWeight: n.is_read ? 600 : 800, color: "#fff", lineHeight: 1.3 }}>
                            {n.title}
                          </div>
                        </div>

                        {isInquiry && (
                          <div style={{ display: "inline-block", fontSize: 9, fontWeight: 900, textTransform: "uppercase", padding: "1px 5px", borderRadius: 4, background: "rgba(245, 158, 11, 0.25)", color: "#fbbf24", marginBottom: 6 }}>
                            Official Inquiry Notice
                          </div>
                        )}

                        <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 6, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                          {n.message}
                        </div>

                        {/* Coach Reply Section for Inquiry */}
                        {isInquiry && n.data?.report_id && (
                          <div style={{ marginTop: 6 }}>
                            {replyingId === n.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(0,0,0,0.25)", padding: 8, borderRadius: 8, border: "1px solid rgba(251, 191, 36, 0.3)" }}>
                                <textarea
                                  rows={3}
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Provide your official response or perspective regarding this inquiry..."
                                  style={{
                                    width: "100%",
                                    padding: 8,
                                    borderRadius: 6,
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    color: "#fff",
                                    fontSize: 12,
                                    outline: "none",
                                    resize: "vertical"
                                  }}
                                />
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => { setReplyingId(null); setReplyText(""); }}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      background: "rgba(255,255,255,0.06)",
                                      border: "1px solid rgba(255,255,255,0.1)",
                                      color: "#cbd5e1",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer"
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSendReply(n)}
                                    disabled={replyLoading}
                                    style={{
                                      padding: "5px 12px",
                                      borderRadius: 6,
                                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                                      border: "none",
                                      color: "#fff",
                                      fontSize: 11,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4
                                    }}
                                  >
                                    <Send size={11} /> {replyLoading ? "Submitting..." : "Send Response to Admin"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setReplyingId(n.id); setReplyText(""); }}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  background: "rgba(245, 158, 11, 0.2)",
                                  border: "1px solid rgba(245, 158, 11, 0.4)",
                                  color: "#fbbf24",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5
                                }}
                              >
                                <MessageSquare size={12} /> Reply to Administration
                              </button>
                            )}
                          </div>
                        )}

                        {n.type === 'workout_suggestion' && n.data?.program_note && (
                          <div style={{
                            background: "rgba(245, 158, 11, 0.1)", color: "#F59E0B", padding: "6px 10px",
                            borderRadius: 6, fontSize: 11, marginBottom: 8, fontStyle: "italic",
                            borderLeft: "3px solid #F59E0B"
                          }}>
                            "{n.data.program_note}"
                          </div>
                        )}

                        {n.type === 'workout_suggestion' && n.data && (
                          <button
                            onClick={() => handleAddWorkout(n)}
                            style={{
                              background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "#fff", border: "none",
                              padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                              display: "flex", alignItems: "center", gap: 4, cursor: "pointer"
                            }}
                          >
                            <Plus size={12} /> Add Program to Templates
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <div style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>
                          {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                        {!n.is_read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: 4 }}
                            title="Mark as read"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
