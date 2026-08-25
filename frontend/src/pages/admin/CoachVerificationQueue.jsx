import React, { useState, useEffect } from "react";
import { ShieldCheck, Check, X, FileText, ExternalLink, Clock, AlertTriangle, Eye, Sparkles, Brain, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { admin } from "../../utils/api";

const GOAL_LABELS = {
  muscle_gain: "Muscle Gain & Hypertrophy",
  fat_loss: "Fat Loss & Conditioning",
  powerlifting: "Powerlifting & Peak Strength",
  general_fitness: "General Fitness & Health",
  bodybuilding: "Bodybuilding & Aesthetic Sculpting",
  athletics: "Athletics & Athletic Performance",
  cardio_endurance: "Cardio & Endurance",
  strength_training: "Strength Training",
  flexibility: "Flexibility & Mobility",
  olympic_weightlifting: "Olympic Weightlifting"
};

const EXP_LABELS = {
  beginner: "Novice Instructor (0-1 yr)",
  intermediate: "Certified Trainer (1-3 yrs)",
  advanced: "Advanced Specialist (3-5 yrs)",
  elite: "Senior Master Coach (5+ yrs)"
};

export default function CoachVerificationQueue() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedVerification, setSelectedVerification] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Groq AI Review state
  const [aiReview, setAiReview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadQueue = async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await admin.getVerifications(statusFilter, page, 20);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load coach verifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue(1);
  }, [statusFilter]);

  const loadDetail = async (row) => {
    setSelectedVerification(row);
    setAiReview(null);
    setAiError("");
    try {
      const fullDetail = await admin.getVerificationDetail(row.id);
      setSelectedVerification(fullDetail);
      // Auto trigger Groq AI review
      fetchAiReview(row.id);
    } catch (err) {
      console.error("Failed to load detail", err);
    }
  };

  const fetchAiReview = async (id) => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await admin.getAiReview(id);
      setAiReview(res);
    } catch (err) {
      setAiError(err.message || "Failed to generate Groq AI review.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Are you sure you want to approve this coach?")) return;
    setActionLoading(true);
    try {
      await admin.approveVerification(id);
      setSelectedVerification(null);
      loadQueue(data.page);
    } catch (err) {
      alert(err.message || "Approval failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }
    setActionLoading(true);
    try {
      await admin.rejectVerification(selectedVerification.id, rejectReason.trim());
      setRejectReason("");
      setSelectedVerification(null);
      loadQueue(data.page);
    } catch (err) {
      alert(err.message || "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  };

  const isImage = (url) => {
    if (!url) return false;
    const clean = url.toLowerCase();
    return clean.endsWith(".jpg") || clean.endsWith(".jpeg") || clean.endsWith(".png") || clean.endsWith(".webp") || clean.startsWith("data:image/");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>Coach Verification Queue</h2>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Review and process coach credential applications</div>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: "flex", gap: 6, background: "rgba(255, 255, 255, 0.05)", padding: 4, borderRadius: 12 }}>
          {["pending", "approved", "rejected", ""].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: statusFilter === st ? "rgba(14, 165, 233, 0.2)" : "transparent",
                color: statusFilter === st ? "#38bdf8" : "#94a3b8",
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

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Verification Table */}
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
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Coach</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Submitted</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700 }}>Documents</th>
              <th style={{ padding: "14px 16px", color: "#94a3b8", fontWeight: 700, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Loading queue...</td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#64748b" }}>
                  No coach verifications found for status '{statusFilter || "all"}'.
                </td>
              </tr>
            ) : (
              data.items.map((row) => {
                const docs = Array.isArray(row.document_urls) ? row.document_urls : [];
                return (
                  <tr
                    key={row.id}
                    onClick={() => loadDetail(row)}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      background: selectedVerification?.id === row.id ? "rgba(14, 165, 233, 0.08)" : "transparent"
                    }}
                  >
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
                          {row.coach_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#fff" }}>{row.coach_name}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{row.coach_email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>
                      {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : "N/A"}
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
                            row.status === "approved"
                              ? "rgba(34, 197, 94, 0.15)"
                              : row.status === "rejected"
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(245, 158, 11, 0.15)",
                          color:
                            row.status === "approved"
                              ? "#4ade80"
                              : row.status === "rejected"
                              ? "#f87171"
                              : "#fbbf24"
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12 }}>
                      <span style={{ color: "#38bdf8", fontWeight: 700 }}>{docs.length} File(s)</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          onClick={() => loadDetail(row)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "none",
                            color: "#cbd5e1",
                            cursor: "pointer",
                            fontSize: 12
                          }}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        {row.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(row.id)}
                              disabled={actionLoading}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                background: "rgba(34, 197, 94, 0.2)",
                                border: "1px solid rgba(34, 197, 94, 0.4)",
                                color: "#4ade80",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer"
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => loadDetail(row)}
                              disabled={actionLoading}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                background: "rgba(239, 68, 68, 0.2)",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                color: "#f87171",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer"
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Side-by-Side Coach Verification Review Workspace */}
      {selectedVerification && (
        <div className="modal-overlay" onClick={() => setSelectedVerification(null)} style={{ zIndex: 9999 }}>
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
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(14, 165, 233, 0.2)",
                    border: "1px solid rgba(14, 165, 233, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#38bdf8"
                  }}
                >
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Coach Verification #{selectedVerification.id}</h3>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        background:
                          selectedVerification.status === "approved"
                            ? "rgba(34, 197, 94, 0.2)"
                            : selectedVerification.status === "rejected"
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(245, 158, 11, 0.2)",
                        color:
                          selectedVerification.status === "approved"
                            ? "#4ade80"
                            : selectedVerification.status === "rejected"
                            ? "#f87171"
                            : "#fbbf24"
                      }}
                    >
                      {selectedVerification.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Submitted {selectedVerification.submitted_at ? new Date(selectedVerification.submitted_at).toLocaleDateString() : "N/A"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedVerification(null)}
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
              {/* LEFT COLUMN: Coach Profile & Uploaded Documents */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Coach Profile Card */}
                <div style={{ padding: 14, background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: "rgba(14, 165, 233, 0.2)",
                        border: "1px solid rgba(14, 165, 233, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#38bdf8"
                      }}
                    >
                      {selectedVerification.coach_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{selectedVerification.coach_name}</div>
                      <div style={{ fontSize: 12, color: "#38bdf8" }}>{selectedVerification.coach_email}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Specialty</div>
                      <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
                        {GOAL_LABELS[selectedVerification.coach_goal?.toLowerCase()] || selectedVerification.coach_goal || "General Fitness"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Experience</div>
                      <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
                        {EXP_LABELS[selectedVerification.coach_experience?.toLowerCase()] || selectedVerification.coach_experience || "Certified Instructor"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Age / Sex</div>
                      <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
                        {selectedVerification.coach_age ? `${selectedVerification.coach_age} yrs` : "N/A"} / {selectedVerification.coach_sex === 'M' ? 'Male' : selectedVerification.coach_sex === 'F' ? 'Female' : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {selectedVerification.coach_bio && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Bio Statement</div>
                      <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.4, maxHeight: 80, overflowY: "auto" }}>
                        {selectedVerification.coach_bio}
                      </div>
                    </div>
                  )}
                </div>

                {/* Uploaded Documents Preview */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>
                    Submitted CV & Documentation
                  </div>
                  {(!selectedVerification.document_urls || selectedVerification.document_urls.length === 0) ? (
                    <div style={{ fontSize: 12, color: "#64748b" }}>No document files uploaded.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedVerification.document_urls.map((url, idx) => (
                        <div key={idx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>Document #{idx + 1}</span>
                            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#38bdf8", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                              Open Document <ExternalLink size={12} />
                            </a>
                          </div>
                          {isImage(url) ? (
                            <img
                              src={url}
                              alt={`Doc ${idx + 1}`}
                              style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 6, background: "#000" }}
                            />
                          ) : (
                            <iframe
                              src={url}
                              title={`Doc ${idx + 1}`}
                              style={{ width: "100%", height: 200, border: "none", borderRadius: 6, background: "#fff" }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: AI Compliance & Direct Action Decision Suite */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Groq AI Compliance Review */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(14, 165, 233, 0.1) 100%)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  borderRadius: 14,
                  padding: 14
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#c084fc", fontWeight: 800, fontSize: 13 }}>
                      <Sparkles size={15} /> Groq AI Credential Audit
                    </div>
                    <button
                      onClick={() => fetchAiReview(selectedVerification.id)}
                      disabled={aiLoading}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "none",
                        color: "#c084fc",
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <RefreshCw size={11} className={aiLoading ? "spin" : ""} /> {aiLoading ? "Analyzing..." : "Re-evaluate"}
                    </button>
                  </div>

                  {aiLoading ? (
                    <div style={{ fontSize: 12, color: "#cbd5e1", padding: "10px 0", textAlign: "center" }}>
                      <Brain size={20} style={{ margin: "0 auto 6px", display: "block", color: "#c084fc" }} />
                      Evaluating credentials & qualifications...
                    </div>
                  ) : aiError ? (
                    <div style={{ fontSize: 11, color: "#f87171" }}>{aiError}</div>
                  ) : aiReview ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 900,
                            background:
                              aiReview.recommendation === "APPROVE"
                                ? "rgba(34, 197, 94, 0.2)"
                                : aiReview.recommendation === "REJECT"
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(245, 158, 11, 0.2)",
                            color:
                              aiReview.recommendation === "APPROVE"
                                ? "#4ade80"
                                : aiReview.recommendation === "REJECT"
                                ? "#f87171"
                                : "#fbbf24"
                          }}
                        >
                          RECOMMENDATION: {aiReview.recommendation}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#c084fc" }}>
                          Score: {aiReview.score}/100
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.4 }}>
                        {aiReview.summary}
                      </div>

                      {aiReview.strengths && aiReview.strengths.length > 0 && (
                        <div style={{ fontSize: 11, color: "#4ade80" }}>
                          <strong>Strengths:</strong> {aiReview.strengths.slice(0, 2).join("; ")}
                        </div>
                      )}

                      {aiReview.concerns && aiReview.concerns.length > 0 && (
                        <div style={{ fontSize: 11, color: "#fbbf24" }}>
                          <strong>Concerns:</strong> {aiReview.concerns.slice(0, 2).join("; ")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => fetchAiReview(selectedVerification.id)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        borderRadius: 6,
                        background: "rgba(168, 85, 247, 0.2)",
                        border: "1px solid rgba(168, 85, 247, 0.4)",
                        color: "#c084fc",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Generate AI Review
                    </button>
                  )}
                </div>

                {/* Existing Rejection Reason (if rejected) */}
                {selectedVerification.rejection_reason && (
                  <div style={{ padding: 10, background: "rgba(239, 68, 68, 0.15)", borderRadius: 10, color: "#f87171", fontSize: 12 }}>
                    <strong>Rejection Rationale:</strong> {selectedVerification.rejection_reason}
                  </div>
                )}

                {/* Side-by-Side Decision Suite */}
                {selectedVerification.status === "pending" ? (
                  <div style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 14,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Decision & Action</div>

                    {/* Rejection Note input */}
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 3 }}>
                        Rejection Reason (if rejecting)
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="Specify invalid certification or missing documents..."
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

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "rgba(239, 68, 68, 0.2)",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          color: "#f87171",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4
                        }}
                      >
                        <X size={14} /> Reject Application
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(selectedVerification.id)}
                        disabled={actionLoading}
                        style={{
                          flex: 1.2,
                          padding: "8px 14px",
                          borderRadius: 8,
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          border: "none",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4
                        }}
                      >
                        <Check size={14} /> Approve Coach
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: 12,
                    background: selectedVerification.status === "approved" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${selectedVerification.status === "approved" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    borderRadius: 12,
                    color: selectedVerification.status === "approved" ? "#4ade80" : "#f87171",
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: "center"
                  }}>
                    This application is already {selectedVerification.status.toUpperCase()}.
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
