import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Users, UserPlus, Check, X, Search, Activity, ChevronRight, Dumbbell, TrendingUp, Calendar, AlertCircle, MessageSquare, Award, Heart, MapPin, Navigation, ShieldAlert, FileText, Sliders, ClipboardList, Camera, Download, Star, Video } from "lucide-react";
import Header from "../components/layout/Header";
import { api } from "../utils/api";
import { fmt } from "../utils/formatters";
import SuggestWorkoutModal from "../components/modals/SuggestWorkoutModal";
import CoachChatModal from "../components/modals/CoachChatModal";
import CoachProfileModal from "../components/modals/CoachProfileModal";
import VideoCallScreen from "../components/video/VideoCallScreen";
import BodySilhouette from "../components/cards/BodySilhouette";
import BodyMapWidget from "../components/widgets/BodyMapWidget";
import { useAuth } from "../utils/auth";
import { resolveBackendUrl } from "../utils/config";
import RequireCoachRole from "../components/auth/RequireCoachRole";
import CoachWorkspaceNav from "../components/coach/CoachWorkspaceNav";
import ScheduleSection from "../components/coach/ScheduleSection";
import AiReportsSection from "../components/coach/AiReportsSection";
import EventsSection from "../components/coach/EventsSection";
import L from "../utils/leafletSetup";

const GOAL_LABELS = {
  muscle_gain: "Muscle Gain & Hypertrophy",
  fat_loss: "Fat Loss & Conditioning",
  powerlifting: "Powerlifting & Strength",
  general_fitness: "General Fitness & Health",
  bodybuilding: "Classic Bodybuilding",
  athletics: "Athletics & Performance",
  cardio_endurance: "Cardio & Endurance",
  strength_training: "Strength Training",
  flexibility: "Flexibility & Mobility",
  olympic_weightlifting: "Olympic Weightlifting"
};

const EXP_LABELS = {
  beginner: "Certified Instructor",
  intermediate: "Advanced Trainer",
  advanced: "Elite Coach",
  elite: "Master Coach & Expert"
};

const getCoachBio = (c) => {
  if (!c) return "";
  const goalText = {
    muscle_gain: "building lean muscle mass, optimizing hypertrophy protocols, and improving mechanical lifting efficiency",
    fat_loss: "metabolic conditioning, body recomposition, and creating sustainable fat-loss nutrition plans",
    powerlifting: "strength progression, absolute power output, and mastering squat, bench, and deadlift technique",
    bodybuilding: "sculpting aesthetic symmetry, targeted muscle development, and competition coaching",
    general_fitness: "functional fitness, cardiovascular health, and creating active wellness habits"
  }[c.goal] || "functional training and athletic conditioning";

  const expText = {
    elite: "As a master-level elite coach with over 8 years of personal training experience",
    advanced: "With advanced coaching certifications and years of active athlete preparation",
    intermediate: "As an advanced certified coach and passionate fitness professional"
  }[c.experience] || "As a certified personal trainer";

  return `${expText}, I specialize in ${goalText}. I design personalized training systems that adapt to your daily fatigue, injuries, and lifestyle goals. My training philosophy is built on scientific programming, progress metrics, and strict form execution to ensure safe, results-oriented training.`;
};

export default function CoachDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("roster"); // 'roster' | 'my-coach'
  const [selectedCoachForInfo, setSelectedCoachForInfo] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState("all");
  const [athletes, setAthletes] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(() => user?.role || user?.profile?.role || "athlete");

  // Coach action states
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [nutrCal, setNutrCal] = useState(2000);
  const [nutrProt, setNutrProt] = useState(150);
  const [nutrCarb, setNutrCarb] = useState(200);
  const [nutrFat, setNutrFat] = useState(70);
  const [submittingNutrition, setSubmittingNutrition] = useState(false);

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInAdherence, setCheckInAdherence] = useState(100);
  const [checkInStatus, setCheckInStatus] = useState("on_track");
  const [checkInFeedback, setCheckInFeedback] = useState("");
  const [checkInFocusAreas, setCheckInFocusAreas] = useState("");
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  // Onboarding States
  const [onboardSpecialty, setOnboardSpecialty] = useState("muscle_gain");
  const [onboardExperience, setOnboardExperience] = useState("beginner");
  const [onboardAge, setOnboardAge] = useState(25);
  const [onboardSex, setOnboardSex] = useState("M");
  const [onboardBio, setOnboardBio] = useState("");
  const [onboardCVFile, setOnboardCVFile] = useState(null);
  const [onboardError, setOnboardError] = useState(null);
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!onboardCVFile) {
      setOnboardError("Please upload your CV document.");
      return;
    }
    setOnboardError(null);
    setOnboardSubmitting(true);

    const fd = new FormData();
    fd.append("specialty", onboardSpecialty);
    fd.append("experience", onboardExperience);
    fd.append("age", onboardAge);
    fd.append("sex", onboardSex);
    fd.append("bio", onboardBio);
    fd.append("cv_file", onboardCVFile);

    try {
      await api.submitCoachOnboarding(fd);
      await fetchVerification();
    } catch (err) {
      setOnboardError(err.message || "Failed to submit onboarding.");
    } finally {
      setOnboardSubmitting(false);
    }
  };

  const renderCoachOnboarding = () => {
    const isSuspended = profile?.is_suspended || user?.is_suspended || user?.profile?.is_suspended;
    const suspensionReason = profile?.suspension_reason || user?.suspension_reason || user?.profile?.suspension_reason || "Violation of coaching guidelines";
    const suspendedUntil = profile?.suspended_until || user?.suspended_until || user?.profile?.suspended_until;

    if (isSuspended) {
      return (
        <div style={{
          background: "rgba(239, 68, 68, 0.08)", border: "1.5px solid rgba(239, 68, 68, 0.4)", borderRadius: 28,
          padding: 40, maxWidth: 640, margin: "40px auto", textAlign: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)", backdropFilter: "blur(16px)"
        }}>
          <div style={{
            background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
            width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", color: "#ef4444"
          }}>
            <ShieldAlert size={44} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: "0 0 12px" }}>
            {suspendedUntil ? "Coach Account Temporarily Suspended" : "Coach Account Suspended"}
          </h2>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.4)",
            padding: "6px 16px", borderRadius: 20, color: "#f87171", fontSize: 13, fontWeight: 800, marginBottom: 20
          }}>
            {suspendedUntil ? `Temporarily suspended until ${new Date(suspendedUntil).toLocaleDateString()}` : "Indefinite Suspension"}
          </div>
          <p style={{ fontSize: 14, color: "var(--color-text-2)", lineHeight: 1.6, margin: "0 0 20px" }}>
            Your coach profile is currently hidden from athlete discovery and client interactions are paused due to an administrative suspension.
          </p>
          <div style={{
            background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
            padding: 20, textAlign: "left", display: "flex", flexDirection: "column", gap: 8
          }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Stated Reason for Suspension:</div>
            <div style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>{suspensionReason}</div>
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 20 }}>
            If you have questions or wish to appeal this action, please review any official inquiry messages in your notifications center or contact platform administration.
          </p>
        </div>
      );
    }

    const isApproved = profile?.verification_status === "approved" || (!profile?.verification_status && (profile?.approved || profile?.coach_verified));
    const isPending = profile?.verification_status === "pending" || (!isApproved && Boolean(profile?.cv_url));
    const isRejected = profile?.verification_status === "rejected";

    if (isPending) {
      return (
        <div style={{
          background: "var(--bg-glass)", border: "1px solid var(--border-card)", borderRadius: 28,
          padding: 40, maxWidth: 600, margin: "40px auto", textAlign: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)", backdropFilter: "blur(16px)"
        }}>
          <div style={{
            background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)",
            width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", color: "#f59e0b"
          }}>
            <ShieldAlert size={42} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: "0 0 12px" }}>Your Profile is Under Review</h2>
          <p style={{ fontSize: 14, color: "var(--color-text-2)", lineHeight: 1.6, margin: "0 0 24px" }}>
            Thank you for submitting your CV and qualifications. Our administrative team is currently verifying your details. You will be notified and granted access to the Athlete Roster as soon as your account is approved.
          </p>
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16,
            padding: 20, textAlign: "left", display: "flex", flexDirection: "column", gap: 10
          }}>
            <div style={{ fontSize: 12, color: "var(--color-text-3)", textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>Submitted Profile Info:</div>
            <div style={{ fontSize: 13, color: "var(--color-text)" }}>
              <strong>Specialty:</strong> {GOAL_LABELS[profile?.goal?.toLowerCase()] || profile?.goal?.toUpperCase() || "General Fitness"}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text)" }}>
              <strong>Experience:</strong> {EXP_LABELS[profile?.experience?.toLowerCase()] || profile?.experience?.toUpperCase() || "Certified Instructor"}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text)" }}>
              <strong>Age / Sex:</strong> {profile?.age || 25} years / {profile?.sex === 'M' ? 'Male' : 'Female'}
            </div>
            {profile?.bio && (
              <div style={{ fontSize: 13, color: "var(--color-text)" }}>
                <strong>Bio:</strong> {profile.bio}
              </div>
            )}
            {profile?.cv_url && (
              <div style={{ fontSize: 13, color: "var(--color-text)", wordBreak: "break-all" }}>
                <strong>CV Document:</strong> <a href={resolveBackendUrl(profile.cv_url)} target="_blank" rel="noreferrer" style={{ color: "var(--aura-cyan)", textDecoration: "none", fontWeight: 700 }}>View Uploaded CV</a>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isRejected) {
      return (
        <div style={{
          background: "var(--bg-glass)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 28,
          padding: 40, maxWidth: 600, margin: "40px auto", textAlign: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)", backdropFilter: "blur(16px)"
        }}>
          <div style={{
            background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)",
            width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", color: "#ef4444"
          }}>
            <AlertCircle size={42} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: "0 0 12px" }}>Application Needs Revision</h2>
          <p style={{ fontSize: 14, color: "var(--color-text-2)", lineHeight: 1.6, margin: "0 0 24px" }}>
            {profile?.rejection_reason || "Your verification application could not be approved. Please review your credentials and resubmit updated verification documents below."}
          </p>
        </div>
      );
    }

    return (
      <div style={{
        background: "var(--bg-glass)", border: "1px solid var(--border-card)", borderRadius: 28,
        padding: 40, maxWidth: 640, margin: "40px auto",
        boxShadow: "0 20px 40px rgba(0,0,0,0.4)", backdropFilter: "blur(16px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 20 }}>
          <div style={{
            background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.2)",
            width: 54, height: 54, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--aura-cyan)"
          }}>
            <FileText size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>Coach Verification</h2>
            <p style={{ fontSize: 12, color: "var(--color-text-3)", margin: "4px 0 0" }}>
              Submit your credentials to be listed as a resident trainer.
            </p>
          </div>
        </div>

        <form onSubmit={handleOnboardSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {onboardError && (
            <div style={{
              background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)",
              color: "#EF4444", fontSize: 13, padding: "12px 16px", borderRadius: 12, fontWeight: 600
            }}>
              {onboardError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-2)" }}>Primary Specialty</label>
              <select
                value={onboardSpecialty}
                onChange={e => setOnboardSpecialty(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.03)", color: "#fff", border: "1px solid var(--border-card)",
                  borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none", cursor: "pointer"
                }}
              >
                {Object.entries(GOAL_LABELS).map(([key, val]) => (
                  <option key={key} value={key} style={{ background: "#111" }}>{val}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-2)" }}>Experience Level</label>
              <select
                value={onboardExperience}
                onChange={e => setOnboardExperience(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.03)", color: "#fff", border: "1px solid var(--border-card)",
                  borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none", cursor: "pointer"
                }}
              >
                {Object.entries(EXP_LABELS).map(([key, val]) => (
                  <option key={key} value={key} style={{ background: "#111" }}>{val}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-2)" }}>Age (Years)</label>
              <input
                type="number"
                min="18"
                max="100"
                value={onboardAge}
                onChange={e => setOnboardAge(parseInt(e.target.value))}
                style={{
                  background: "rgba(255,255,255,0.03)", color: "#fff", border: "1px solid var(--border-card)",
                  borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none"
                }}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-2)" }}>Sex</label>
              <select
                value={onboardSex}
                onChange={e => setOnboardSex(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.03)", color: "#fff", border: "1px solid var(--border-card)",
                  borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none", cursor: "pointer"
                }}
              >
                <option value="M" style={{ background: "#111" }}>Male</option>
                <option value="F" style={{ background: "#111" }}>Female</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-2)" }}>Training Bio / Philosophy</label>
            <textarea
              value={onboardBio}
              onChange={e => setOnboardBio(e.target.value)}
              placeholder="Tell athletes about your certifications, experience, and fitness philosophy..."
              style={{
                background: "rgba(255,255,255,0.03)", color: "#fff", border: "1px solid var(--border-card)",
                borderRadius: 12, padding: "12px 14px", fontSize: 13, minHeight: 80, outline: "none", resize: "none"
              }}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-2)" }}>Upload CV Document (PDF, Word, or Image)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={e => setOnboardCVFile(e.target.files[0])}
              style={{
                background: "rgba(255,255,255,0.01)", color: "#fff", border: "1px dashed var(--border-card)",
                borderRadius: 12, padding: "16px", fontSize: 13, outline: "none", cursor: "pointer"
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={onboardSubmitting}
            className="btn-primary"
            style={{ padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 800, marginTop: 10, width: "auto" }}
          >
            {onboardSubmitting ? "Submitting Application..." : "Submit Verification Profile"}
          </button>
        </form>
      </div>
    );
  };

  // Invite state
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteStatus, setInviteStatus] = useState(null);

  // Selected Athlete State
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteStats, setAthleteStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [chatRecipient, setChatRecipient] = useState(null);
  const [activeVideoCall, setActiveVideoCall] = useState(null);

  // Clicked Workout Detail
  const [selectedWorkoutDetail, setSelectedWorkoutDetail] = useState(null);
  const [loadingWorkoutDetail, setLoadingWorkoutDetail] = useState(false);
  const [sessionNotes, setSessionNotes] = useState([]);
  const [newSessionNote, setNewSessionNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Gym Map Explorer states
  const [gyms, setGyms] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLoc, setUserLoc] = useState({ lat: 36.8065, lng: 10.1815 });
  const [nearestGyms, setNearestGyms] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [coachSelectedGyms, setCoachSelectedGyms] = useState([]);

  const REGIONS = {
    all: { name: "All Tunisia", lat: 36.8065, lng: 10.1815 },
    tunis: { name: "Tunis", lat: 36.8350, lng: 10.2300 },
    ariana: { name: "Ariana", lat: 36.8625, lng: 10.1956 },
    ben_arous: { name: "Ben Arous", lat: 36.7533, lng: 10.2223 },
    manouba: { name: "Manouba", lat: 36.8080, lng: 10.0980 },
    bizerte: { name: "Bizerte", lat: 37.2745, lng: 9.8739 },
    nabeul: { name: "Nabeul / Hammamet", lat: 36.4560, lng: 10.7376 },
    sousse: { name: "Sousse / Sahel", lat: 35.8256, lng: 10.6369 },
    sfax: { name: "Sfax", lat: 34.7406, lng: 10.7603 },
    south: { name: "Djerba & South", lat: 33.8075, lng: 10.9925 }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Load Leaflet - now imported via npm, always available
  useEffect(() => {
    setMapLoaded(true);

    // Inject dark-mode map styles
    const styleId = 'leaflet-dark-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        #leaflet-coaches-map .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        #leaflet-coaches-map {
          background: #111 !important;
        }
        .leaflet-popup-content-wrapper {
          background: var(--color-bg) !important;
          color: var(--color-text) !important;
          border: 1px solid var(--border-card);
        }
        .leaflet-popup-tip {
          background: var(--color-bg) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const fetchVerification = async () => {
    setLoading(true);
    try {
      const data = await api.getCoachVerificationStatus();
      setProfile(data);
      if (data?.role) {
        setRole(data.role);
        if (data.role === "coach") setActiveTab("roster");
        else setActiveTab("my-coach");
      }
    } catch (err) {
      console.error("Failed to load coach verification status:", err);
      if (user?.profile) {
        setProfile(user.profile);
        if (user.profile.role) setRole(user.profile.role);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchVerification();
  }, [location.pathname]);

  const loadGyms = async () => {
    try {
      const res = await api.getGyms();
      setGyms(res || []);
      if (role === 'coach') {
        const selected = res
          .filter(g => g.coaches?.some(c => c.coach_id === user?.user_id))
          .map(g => g.id);
        setCoachSelectedGyms(selected);
      }
    } catch (e) {
      console.error("Error loading gyms:", e);
    }
  };

  useEffect(() => {
    loadGyms();
  }, [role, user]);

  useEffect(() => {
    if (!userLoc || !gyms.length) return;
    const computed = gyms.map(g => {
      const dist = calculateDistance(userLoc.lat, userLoc.lng, g.latitude, g.longitude);
      return { ...g, distance: dist };
    })
      .filter(g => {
        if (selectedGoal === "all") return true;
        return g.coaches?.some(c => c.goal === selectedGoal);
      })
      .sort((a, b) => a.distance - b.distance);
    setNearestGyms(computed);
  }, [userLoc, gyms, selectedGoal]);

  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapLoaded || !gyms.length || activeTab !== 'my-coach') return;

    const container = window.L.DomUtil.get("leaflet-coaches-map");
    if (!container) return;

    const L = window.L;

    // Clean up previous map instance if it exists
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (err) {
        console.error("Error removing old map:", err);
      }
      mapRef.current = null;
    }

    const map = L.map("leaflet-coaches-map").setView([userLoc.lat, userLoc.lng], selectedRegion === 'all' ? 10 : 12);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Force map invalidateSize after rendering multiple times during layout transitions
    const timer1 = setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 100);
    const timer2 = setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 400);
    const timer3 = setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 800);

    const userIcon = L.divIcon({
      className: 'user-marker-icon',
      html: `<div style="background: var(--aura-accent); border: 2px solid #000; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 10px var(--aura-accent);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const userMarker = L.marker([userLoc.lat, userLoc.lng], { icon: userIcon, draggable: true }).addTo(map);
    userMarker.on('dragend', (e) => {
      const position = e.target.getLatLng();
      setUserLoc({ lat: position.lat, lng: position.lng });
    });

    const filteredGyms = gyms.filter(g => {
      if (selectedGoal === "all") return true;
      return g.coaches?.some(c => c.goal === selectedGoal);
    });

    filteredGyms.forEach(g => {
      const gymIcon = L.divIcon({
        className: 'gym-marker-icon',
        html: `<div style="background: var(--aura-cyan); border: 2px solid #000; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px var(--aura-cyan); color: #000; font-size: 10px; font-weight: 800;">G</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const marker = L.marker([g.latitude, g.longitude], { icon: gymIcon }).addTo(map);

      const coachCountText = selectedGoal === "all"
        ? `${g.coaches?.length || 0} Coaches`
        : `${g.coaches?.filter(c => c.goal === selectedGoal).length || 0} specialized`;

      marker.bindPopup(`
        <div style="color: #fff; font-family: sans-serif; font-size: 12px; padding: 4px;">
          <strong style="font-size: 13px; color: var(--aura-cyan);">${g.name}</strong><br/>
          <span style="color: #ccc;">${g.address || ""}</span><br/>
          <strong style="color: var(--aura-accent);">${coachCountText}</strong>
        </div>
      `);

      marker.on('click', () => {
        setUserLoc({ lat: g.latitude, lng: g.longitude });
      });
    });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (mapRef.current) {
        try {
          mapRef.current.stop?.();
          mapRef.current.off?.();
          mapRef.current.remove?.();
        } catch (err) {
          console.error("Error cleaning up map:", err);
        }
        mapRef.current = null;
      }
      if (container && container._leaflet_id) {
        container._leaflet_id = null;
      }
    };
  }, [mapLoaded, gyms, selectedRegion, activeTab, selectedGoal]);

  const handleToggleGym = async (gymId) => {
    const updated = coachSelectedGyms.includes(gymId)
      ? coachSelectedGyms.filter(id => id !== gymId)
      : [...coachSelectedGyms, gymId];

    setCoachSelectedGyms(updated);
    try {
      await api.selectCoachGyms(updated);
      loadGyms();
    } catch (e) {
      console.error("Failed to save gym selection", e);
    }
  };

  const fetchData = async () => {
    try {
      const [aths, coachesList] = await Promise.all([
        api.getMyAthletes().catch(() => []),
        api.getAllCoaches().catch(() => [])
      ]);
      setAthletes(aths || []);
      setCoaches(coachesList || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteIdentifier.trim()) return;

    try {
      const res = await api.inviteAthlete(inviteIdentifier);
      setInviteStatus({ type: "success", msg: res.message || `Invite sent` });
      setInviteIdentifier("");
      fetchData();
    } catch (e) {
      setInviteStatus({ type: "error", msg: e.message || "Failed to invite" });
    }

    setTimeout(() => setInviteStatus(null), 3000);
  };

  const handleHireCoach = async (coachId) => {
    try {
      const res = await api.hireCoach(coachId);
      setInviteStatus({ type: "success", msg: res.message || "Request sent!" });
      fetchData();
    } catch (e) {
      setInviteStatus({ type: "error", msg: e.message || "Failed to hire coach" });
    }
    setTimeout(() => setInviteStatus(null), 3000);
  };

  const handleResponse = async (relationshipId, action) => {
    try {
      await api.respondInvite(relationshipId, action);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleKickAthlete = async (relationshipId, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from your roster?`)) return;
    try {
      await api.removeRelationship(relationshipId);
      setSelectedAthlete(null);
      fetchData();
    } catch (e) {
      console.error("Failed to remove athlete:", e);
      alert(e.message || "Failed to remove athlete");
    }
  };

  const loadAthleteStats = async (athlete) => {
    setSelectedAthlete(athlete);
    setLoadingStats(true);
    try {
      const stats = await api.getAthleteStats(athlete.athlete_id);
      setAthleteStats(stats);
    } catch (e) {
      console.error("Failed to load athlete stats", e);
      setAthleteStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const openNutritionModal = () => {
    if (athleteStats?.nutrition_target) {
      setNutrCal(Math.round(athleteStats.nutrition_target.final_calories) || 2000);
      setNutrProt(Math.round(athleteStats.nutrition_target.final_protein) || 150);
      setNutrCarb(Math.round(athleteStats.nutrition_target.final_carbs) || 200);
      setNutrFat(Math.round(athleteStats.nutrition_target.final_fat) || 70);
    } else {
      setNutrCal(2000);
      setNutrProt(150);
      setNutrCarb(200);
      setNutrFat(70);
    }
    setShowNutritionModal(true);
  };

  const handleAssignNutrition = async (e) => {
    e.preventDefault();
    if (!selectedAthlete) return;
    setSubmittingNutrition(true);
    try {
      await api.assignNutritionTarget(selectedAthlete.athlete_id, {
        final_calories: parseFloat(nutrCal),
        final_protein: parseFloat(nutrProt),
        final_carbs: parseFloat(nutrCarb),
        final_fat: parseFloat(nutrFat),
        goal: "Coach Assigned"
      });
      // Refresh athlete stats
      await loadAthleteStats(selectedAthlete);
      setShowNutritionModal(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to assign nutrition targets.");
    } finally {
      setSubmittingNutrition(false);
    }
  };

  const handleSubmitCheckIn = async (e) => {
    e.preventDefault();
    if (!selectedAthlete) return;
    setSubmittingCheckIn(true);
    try {
      const focusAreasList = checkInFocusAreas
        .split(",")
        .map(x => x.trim())
        .filter(x => x.length > 0);

      await api.submitCheckIn(selectedAthlete.athlete_id, {
        adherence_rate: parseInt(checkInAdherence),
        status_label: checkInStatus,
        feedback: checkInFeedback,
        focus_areas: focusAreasList
      });

      setCheckInFeedback("");
      setCheckInFocusAreas("");
      setCheckInAdherence(100);
      setCheckInStatus("on_track");

      await loadAthleteStats(selectedAthlete);
      setShowCheckInModal(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to submit check-in review.");
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const handleDownloadReport = () => {
    if (!selectedAthlete || !athleteStats) return;

    const athleteName = selectedAthlete.name || selectedAthlete.email.split('@')[0];
    const avgSleep = athleteStats.recent_sleep?.length
      ? (athleteStats.recent_sleep.reduce((acc, s) => acc + s.hours, 0) / athleteStats.recent_sleep.length).toFixed(1)
      : "N/A";
    const avgQuality = athleteStats.recent_sleep?.length
      ? (athleteStats.recent_sleep.reduce((acc, s) => acc + s.quality, 0) / athleteStats.recent_sleep.length).toFixed(1)
      : "N/A";

    const avgCal = athleteStats.recent_nutrition?.length
      ? Math.round(athleteStats.recent_nutrition.reduce((acc, n) => acc + n.calories, 0) / athleteStats.recent_nutrition.length)
      : "N/A";
    const avgProt = athleteStats.recent_nutrition?.length
      ? Math.round(athleteStats.recent_nutrition.reduce((acc, n) => acc + n.protein, 0) / athleteStats.recent_nutrition.length)
      : "N/A";
    const avgCarb = athleteStats.recent_nutrition?.length
      ? Math.round(athleteStats.recent_nutrition.reduce((acc, n) => acc + n.carbs, 0) / athleteStats.recent_nutrition.length)
      : "N/A";
    const avgFat = athleteStats.recent_nutrition?.length
      ? Math.round(athleteStats.recent_nutrition.reduce((acc, n) => acc + n.fat, 0) / athleteStats.recent_nutrition.length)
      : "N/A";

    const target = athleteStats.nutrition_target;

    const getBodyPartColor = (partKey) => {
      const activeInjury = (athleteStats.active_injuries || []).find(i => i.body_part === partKey);
      if (activeInjury) {
        return activeInjury.severity >= 6 ? "#EF4444" : "#F97316";
      }
      const isTracked = athleteStats.measurements?.[0]?.[partKey] != null;
      if (isTracked) {
        return "#06b6d4";
      }
      return "rgba(255, 255, 255, 0.1)";
    };

    const headColor = getBodyPartColor('neck');
    const shouldersColor = getBodyPartColor('shoulders');
    const chestColor = getBodyPartColor('chest');
    const waistColor = getBodyPartColor('waist');
    const leftArmColor = getBodyPartColor('left_arm');
    const rightArmColor = getBodyPartColor('right_arm');
    const leftThighColor = getBodyPartColor('left_thigh');
    const rightThighColor = getBodyPartColor('right_thigh');
    const leftCalfColor = getBodyPartColor('left_calf');
    const rightCalfColor = getBodyPartColor('right_calf');
    const backColor = getBodyPartColor('upper_back') !== 'rgba(255, 255, 255, 0.1)' ? getBodyPartColor('upper_back') : getBodyPartColor('lower_back');

    const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hpi Progress Report - ${athleteName}</title>
  <style>
    :root {
      --color-bg: #090e17;
      --color-surface: #111827;
      --bg-glass: rgba(17, 24, 39, 0.7);
      --border-card: rgba(255, 255, 255, 0.08);
      --aura-accent: #6366f1;
      --aura-cyan: #06b6d4;
      --aura-accent2: #f59e0b;
      --aura-accent3: #ef4444;
      --color-text: #f3f4f6;
      --color-text-2: #d1d5db;
      --color-text-3: #9ca3af;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: var(--color-text);
      background-color: var(--color-bg);
      line-height: 1.6;
      margin: 0;
      padding: 40px;
    }
    .container {
      max-width: 1050px;
      margin: 0 auto;
      background: var(--bg-glass);
      border: 1px solid var(--border-card);
      backdrop-filter: blur(12px);
      padding: 40px;
      border-radius: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      color: var(--color-text);
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 4px 0 0;
      color: var(--color-text-3);
      font-size: 13px;
    }
    .client-details {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      background: rgba(255,255,255,0.015);
      border: 1px solid var(--border-card);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 32px;
    }
    .detail-card {
      display: flex;
      flex-direction: column;
    }
    .detail-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-text-3);
      letter-spacing: 0.5px;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text-2);
      margin-top: 4px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--color-text);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 6px;
      margin-top: 0;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .grid-layout {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
      align-items: start;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .card-block {
      background: rgba(255,255,255,0.015);
      border: 1px solid var(--border-card);
      border-radius: 16px;
      padding: 20px;
    }
    .card-span-2 {
      grid-column: span 2;
    }
    .stats-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    .stats-table th, .stats-table td {
      padding: 8px 10px;
      text-align: left;
      font-size: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .stats-table th {
      font-weight: 700;
      color: var(--color-text-3);
    }
    .badge {
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-on_track { background: rgba(34, 197, 94, 0.15); color: #22C55E; }
    .badge-needs_focus { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .badge-off_track { background: rgba(239, 68, 68, 0.15); color: #EF4444; }
    .review-card {
      border: 1px solid var(--border-card);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 12px;
      background: rgba(255,255,255,0.01);
    }
    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .review-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text);
    }
    .review-notes {
      font-size: 12px;
      color: var(--color-text-2);
      margin: 0;
      line-height: 1.5;
    }
    .focus-areas {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
    .focus-pill {
      font-size: 9px;
      font-weight: 600;
      background: rgba(6, 182, 212, 0.05);
      border: 1px solid rgba(6, 182, 212, 0.1);
      color: var(--aura-cyan);
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    .progress-container {
      margin-bottom: 12px;
    }
    .progress-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .progress-bar-bg {
      height: 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 3px;
    }
    
    @media print {
      body {
        padding: 0;
        background: #080c14 !important;
        color: #f3f4f6 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .container {
        box-shadow: none;
        padding: 0;
        border: none;
        background: transparent;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>Hpi Progress Report</h1>
        <p>Generated on ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
      </div>
      <div style="text-align: right">
        <span style="font-size: 12px; font-weight: 800; color: var(--aura-cyan); letter-spacing: 0.1em;">HPI ATHLETE DOSSIER</span>
      </div>
    </div>

    <div class="client-details">
      <div class="detail-card">
        <span class="detail-label">Client Name</span>
        <span class="detail-value">${athleteName}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Email Address</span>
        <span class="detail-value">${selectedAthlete.email}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Experience Level</span>
        <span class="detail-value">${(selectedAthlete.experience || "N/A").toUpperCase()}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Current Weight</span>
        <span class="detail-value">${selectedAthlete.bodyweight > 0 ? `${selectedAthlete.bodyweight} KG` : "N/A"}</span>
      </div>
    </div>

    <div class="grid-layout">
      <!-- Left Column: Metrics Grid -->
      <div class="metrics-grid">
        <!-- TRAINING SUMMARY -->
        <div class="card-block">
          <div class="section-title">Training Summary</div>
          <table class="stats-table">
            <tr>
              <td style="color: var(--color-text-3); padding-left: 0;">Total Sessions</td>
              <td style="font-weight: 700; text-align: right; padding-right: 0;">${athleteStats.workout_summary?.total_sessions || 0}</td>
            </tr>
            <tr>
              <td style="color: var(--color-text-3); padding-left: 0;">Total Volume</td>
              <td style="font-weight: 700; text-align: right; padding-right: 0;">${athleteStats.set_summary?.total_volume ? `${(athleteStats.set_summary.total_volume).toLocaleString()} kg` : "0 kg"}</td>
            </tr>
            <tr>
              <td style="color: var(--color-text-3); padding-left: 0;">Avg Duration</td>
              <td style="font-weight: 700; text-align: right; padding-right: 0;">${Math.round((athleteStats.workout_summary?.avg_duration_sec || 0) / 60)} min</td>
            </tr>
            <tr>
              <td style="color: var(--color-text-3); padding-left: 0;">Last Active</td>
              <td style="font-weight: 700; text-align: right; padding-right: 0;">${athleteStats.workout_summary?.last_session ? new Date(athleteStats.workout_summary.last_session).toLocaleDateString() : "Never"}</td>
            </tr>
          </table>
        </div>

        <!-- RECENT WORKOUTS -->
        <div class="card-block">
          <div class="section-title">Recent Workouts</div>
          ${athleteStats.recent_workouts?.length > 0
        ? `
            <table class="stats-table">
              ${athleteStats.recent_workouts.slice(0, 4).map(w => `
                <tr>
                  <td style="padding-left: 0;">
                    <div style="font-weight: 700; color: var(--color-text);">${w.workout_name}</div>
                    <div style="font-size: 10px; color: var(--color-text-3); margin-top: 2px;">${new Date(w.session_date).toLocaleDateString()}</div>
                  </td>
                  <td style="font-weight: 700; color: var(--aura-cyan); text-align: right; vertical-align: middle; padding-right: 0;">${Math.round(w.volume)} kg</td>
                </tr>
              `).join('')}
            </table>
            `
        : `<p style="font-size: 12px; color: var(--color-text-3); margin: 0;">No recent workouts logged.</p>`
      }
        </div>

        <!-- NUTRITION TARGETS -->
        <div class="card-block">
          <div class="section-title">Nutrition Compliance</div>
          ${target
        ? `
            <div style="font-size: 11px; color: var(--color-text-3); margin-bottom: 12px;">
              Goal: <strong style="color: #fff;">${target.goal}</strong>
            </div>
            
            <div class="progress-container">
              <div class="progress-header">
                <span>Calories (7-day avg)</span>
                <span>${avgCal} / ${Math.round(target.final_calories)} kcal</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${Math.min((avgCal / target.final_calories) * 100, 100)}%; background: var(--aura-accent);"></div>
              </div>
            </div>

            <div class="progress-container">
              <div class="progress-header">
                <span>Protein</span>
                <span>${avgProt}g / ${Math.round(target.final_protein)}g</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${Math.min((avgProt / target.final_protein) * 100, 100)}%; background: #f59e0b;"></div>
              </div>
            </div>

            <div class="progress-container">
              <div class="progress-header">
                <span>Carbohydrates</span>
                <span>${avgCarb}g / ${Math.round(target.final_carbs)}g</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${Math.min((avgCarb / target.final_carbs) * 100, 100)}%; background: var(--aura-cyan);"></div>
              </div>
            </div>

            <div class="progress-container">
              <div class="progress-header">
                <span>Fats</span>
                <span>${avgFat}g / ${Math.round(target.final_fat)}g</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${Math.min((avgFat / target.final_fat) * 100, 100)}%; background: #ec4899;"></div>
              </div>
            </div>
            `
        : `<p style="font-size: 12px; color: var(--color-text-3); margin: 0;">No active nutrition targets.</p>`
      }
        </div>

        <!-- SLEEP & WELLNESS -->
        <div class="card-block">
          <div class="section-title">Sleep & Wellness</div>
          <table class="stats-table">
            <tr>
              <td style="color: var(--color-text-3); padding-left: 0;">Average Sleep</td>
              <td style="font-weight: 700; text-align: right; padding-right: 0;">${avgSleep} hrs</td>
            </tr>
            <tr>
              <td style="color: var(--color-text-3); padding-left: 0;">Average Quality</td>
              <td style="font-weight: 700; text-align: right; padding-right: 0;">${avgQuality}/5 ★</td>
            </tr>
            <tr>
              <td style="color: var(--color-text-3); padding-left: 0;">Latest Fatigue</td>
              <td style="font-weight: 700; text-align: right; color: ${athleteStats.latest_fatigue?.level === 'high' ? '#ef4444' : 'var(--aura-accent3)'}; padding-right: 0;">
                ${athleteStats.latest_fatigue ? `${athleteStats.latest_fatigue.raw_score}% (${athleteStats.latest_fatigue.label.toUpperCase()})` : "No Logs"}
              </td>
            </tr>
            <tr>
              <td style="color: var(--color-text-3); padding-left: 0;">Active Injuries</td>
              <td style="font-weight: 700; text-align: right; color: ${athleteStats.active_injuries?.length > 0 ? '#ef4444' : '#22C55E'}; padding-right: 0;">
                ${athleteStats.active_injuries?.length > 0
        ? athleteStats.active_injuries.map(i => `${i.body_part} (${i.severity})`).join(', ')
        : "None"}
              </td>
            </tr>
          </table>
        </div>

        <!-- PR RECORDS -->
        <div class="card-block card-span-2">
          <div class="section-title">Best Lifts (PRs)</div>
          ${athleteStats.personal_records?.length > 0
        ? `
            <table class="stats-table">
              <thead>
                <tr>
                  <th style="padding-left: 0;">Exercise</th>
                  <th>Max Weight</th>
                  <th style="text-align: right; padding-right: 0;">Est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                ${athleteStats.personal_records.slice(0, 5).map(pr => `
                  <tr>
                    <td style="font-weight: 700; padding-left: 0;">${pr.exercise_name}</td>
                    <td>${pr.weight_kg} kg × ${pr.reps}</td>
                    <td style="font-weight: 700; color: var(--aura-accent); text-align: right; padding-right: 0;">${Math.round(pr.one_rm_est)} kg</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `
        : `<p style="font-size: 12px; color: var(--color-text-3); margin: 0;">No personal records established.</p>`
      }
        </div>

        <!-- MEASUREMENTS HISTORY -->
        <div class="card-block card-span-2">
          <div class="section-title">Body Measurements History</div>
          ${athleteStats.measurements?.length > 0
        ? `
            <table class="stats-table">
              <thead>
                <tr>
                  <th style="padding-left: 0;">Date</th>
                  <th>Waist</th>
                  <th>Chest</th>
                  <th>Arms (L/R)</th>
                  <th>Thighs (L/R)</th>
                  <th style="text-align: right; padding-right: 0;">Hips</th>
                </tr>
              </thead>
              <tbody>
                ${athleteStats.measurements.slice(0, 5).map(m => `
                  <tr>
                    <td style="font-weight: 700; padding-left: 0;">${new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
                    <td>${m.waist ? `${m.waist} cm` : "-"}</td>
                    <td>${m.chest ? `${m.chest} cm` : "-"}</td>
                    <td>${m.left_arm || "-"}/${m.right_arm || "-"}</td>
                    <td>${m.left_thigh || "-"}/${m.right_thigh || "-"}</td>
                    <td style="text-align: right; padding-right: 0;">${m.hips ? `${m.hips} cm` : "-"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `
        : `<p style="font-size: 12px; color: var(--color-text-3); margin: 0;">No body measurements logged.</p>`
      }
        </div>

        <!-- COACH CHECK-INS -->
        <div class="card-block card-span-2">
          <div class="section-title">Coach Reviews & Weekly Check-ins</div>
          ${athleteStats.check_ins?.length > 0
        ? athleteStats.check_ins.map(c => `
              <div class="review-card">
                <div class="review-header">
                  <span class="review-title">Review on ${new Date(c.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <div>
                    <span class="badge badge-${c.status_label}">${c.status_label.replace('_', ' ').toUpperCase()}</span>
                    <span style="font-size: 11px; font-weight: 800; color: var(--aura-cyan); margin-left: 10px;">Adherence: ${c.adherence_rate}%</span>
                  </div>
                </div>
                <p class="review-notes">${c.feedback}</p>
                ${c.focus_areas && c.focus_areas.length > 0
            ? `
                  <div class="focus-areas">
                    <span style="font-size: 9px; color: var(--color-text-3); font-weight: 700; align-self: center; margin-right: 4px;">FOCUS:</span>
                    ${c.focus_areas.map(area => `<span class="focus-pill">${area}</span>`).join('')}
                  </div>
                  `
            : ''
          }
              </div>
            `).join('')
        : `<p style="font-size: 12px; color: var(--color-text-3); margin: 0; font-style: italic;">No check-in reviews logged yet.</p>`
      }
        </div>
      </div>

      <!-- Right Column: Body Silhouette Heatmap -->
      <div class="card-block" style="position: sticky; top: 0; display: flex; flexDirection: column; gap: 16px;">
        <div class="section-title">Client Body Map</div>
        <p style="margin: 0 0 16px; font-size: 11px; color: var(--color-text-3); line-height: 1.4;">
          Visual muscle heatmap and injury log. Colors track measurement changes (Cyan) and active injuries (Orange/Red).
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 24px; align-items: center;">
          <!-- Anterior -->
          <div style="text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: var(--color-text-3); margin-bottom: 6px; text-transform: uppercase;">Anterior</div>
            <svg width="130" height="210" viewBox="0 0 150 230">
              <circle cx="75" cy="20" r="12" fill="${headColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="72" y="32" width="6" height="8" fill="${headColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="44" y="40" width="62" height="10" rx="3" fill="${shouldersColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="50" y="52" width="50" height="24" rx="2" fill="${chestColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="50" y="78" width="50" height="28" rx="2" fill="${waistColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="28" y="44" width="14" height="60" rx="4" fill="${leftArmColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="108" y="44" width="14" height="60" rx="4" fill="${rightArmColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="50" y="110" width="23" height="54" rx="4" fill="${leftThighColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="77" y="110" width="23" height="54" rx="4" fill="${rightThighColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="53" y="168" width="18" height="50" rx="4" fill="${leftCalfColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="79" y="168" width="18" height="50" rx="4" fill="${rightCalfColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
            </svg>
          </div>
          
          <!-- Posterior -->
          <div style="text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: var(--color-text-3); margin-bottom: 6px; text-transform: uppercase;">Posterior</div>
            <svg width="130" height="210" viewBox="0 0 150 230">
              <circle cx="75" cy="20" r="12" fill="${headColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="72" y="32" width="6" height="8" fill="${headColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="44" y="40" width="62" height="10" rx="3" fill="${shouldersColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="50" y="52" width="50" height="54" rx="2" fill="${backColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="28" y="44" width="14" height="60" rx="4" fill="${leftArmColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="108" y="44" width="14" height="60" rx="4" fill="${rightArmColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="50" y="110" width="23" height="54" rx="4" fill="${leftThighColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="77" y="110" width="23" height="54" rx="4" fill="${rightThighColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="53" y="168" width="18" height="50" rx="4" fill="${leftCalfColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
              <rect x="79" y="168" width="18" height="50" rx="4" fill="${rightCalfColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlReport], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = athleteName.toLowerCase() + '_progress_report.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadWorkoutDetail = async (workoutId) => {
    setLoadingWorkoutDetail(true);
    try {
      const detail = await api.getWorkout(workoutId);
      setSelectedWorkoutDetail(detail);
      const notes = await api.getSessionNotes(workoutId).catch(() => []);
      setSessionNotes(notes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWorkoutDetail(false);
    }
  };

  const handleAddSessionNote = async (e) => {
    e.preventDefault();
    if (!newSessionNote.trim() || !selectedWorkoutDetail) return;
    setSubmittingNote(true);
    try {
      const added = await api.addSessionNote(
        selectedAthlete.athlete_id,
        selectedWorkoutDetail.id,
        newSessionNote
      );
      setSessionNotes([...sessionNotes, added]);
      setNewSessionNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const renderAthleteDetail = () => {
    if (!selectedAthlete) return null;

    const avgSleep = athleteStats?.recent_sleep?.length
      ? (athleteStats.recent_sleep.reduce((acc, s) => acc + s.hours, 0) / athleteStats.recent_sleep.length).toFixed(1)
      : null;
    const avgQuality = athleteStats?.recent_sleep?.length
      ? (athleteStats.recent_sleep.reduce((acc, s) => acc + s.quality, 0) / athleteStats.recent_sleep.length).toFixed(1)
      : null;

    const avgCal = athleteStats?.recent_nutrition?.length
      ? Math.round(athleteStats.recent_nutrition.reduce((acc, n) => acc + n.calories, 0) / athleteStats.recent_nutrition.length)
      : 0;
    const avgProt = athleteStats?.recent_nutrition?.length
      ? Math.round(athleteStats.recent_nutrition.reduce((acc, n) => acc + n.protein, 0) / athleteStats.recent_nutrition.length)
      : 0;
    const avgCarb = athleteStats?.recent_nutrition?.length
      ? Math.round(athleteStats.recent_nutrition.reduce((acc, n) => acc + n.carbs, 0) / athleteStats.recent_nutrition.length)
      : 0;
    const avgFat = athleteStats?.recent_nutrition?.length
      ? Math.round(athleteStats.recent_nutrition.reduce((acc, n) => acc + n.fat, 0) / athleteStats.recent_nutrition.length)
      : 0;

    const nutritionTarget = athleteStats?.nutrition_target;

    return (
      <div style={{
        background: "var(--bg-glass)", borderRadius: 24, border: "1px solid var(--border-card)",
        padding: 24, display: "flex", flexDirection: "column", gap: 24,
        animation: "fadeIn 0.3s ease-out"
      }}>
        {/* Profile Card Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          paddingBottom: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, background: "var(--bg-card)",
              border: "2px solid var(--aura-accent)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 800, color: "var(--aura-accent)", overflow: "hidden"
            }}>
              {selectedAthlete.avatar_url ? (
                <img src={selectedAthlete.avatar_url} alt={selectedAthlete.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (selectedAthlete.name || selectedAthlete.email || 'A').charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>{selectedAthlete.name || selectedAthlete.email.split('@')[0]}</h2>
              <div style={{ fontSize: 12, color: "var(--color-text-3)", marginTop: 2 }}>{selectedAthlete.email}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <span className="glass-pill" style={{ fontSize: 9, padding: "2px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-card)", color: "var(--color-text-2)" }}>{selectedAthlete.experience?.toUpperCase()}</span>
                {selectedAthlete.bodyweight > 0 && <span className="glass-pill" style={{ fontSize: 9, padding: "2px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-card)", color: "var(--color-text-2)" }}>{selectedAthlete.bodyweight} KG</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedAthlete(null)}
            className="btn-secondary"
            style={{ padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
          >
            Back to Roster
          </button>
        </div>

        {/* Coach Actions Toolbar */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center"
        }}>
          <button
            onClick={() => setShowSuggestModal(true)}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, width: "auto" }}
          >
            <Dumbbell size={16} /> Suggest Workout
          </button>
          <button
            onClick={openNutritionModal}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
          >
            <Sliders size={16} /> Assign Macros
          </button>
          <button
            onClick={() => setShowCheckInModal(true)}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
          >
            <ClipboardList size={16} /> Log Review
          </button>
          <button
            onClick={() => setChatRecipient({ ...selectedAthlete, id: selectedAthlete.athlete_id })}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
          >
            <MessageSquare size={16} /> Chat
          </button>
          <button
            onClick={() => setActiveVideoCall({ athleteId: selectedAthlete.athlete_id, coachId: user?.id || user?.user_id, role: 'coach' })}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", border: "1px solid rgba(99, 102, 241, 0.3)" }}
          >
            <Video size={16} /> Video Call
          </button>
          <button
            onClick={handleDownloadReport}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
          >
            <Download size={16} /> Download Report
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => handleKickAthlete(selectedAthlete.relationship_id, selectedAthlete.name)}
            style={{
              background: "rgba(239, 68, 68, 0.05)",
              color: "#EF4444",
              border: "1.5px solid rgba(239, 68, 68, 0.15)",
              padding: "8px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.05)"; }}
          >
            <X size={14} /> Kick Athlete
          </button>
        </div>

        {loadingStats ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-3)" }}>Loading stats...</div>
        ) : athleteStats ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr)", gap: 24, alignItems: "start", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
            {/* Left Column: Metrics and Logs Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, minWidth: 0 }}>
              {/* TRAINING SUMMARY */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent)", marginBottom: 12 }}>
                  <Activity size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>TRAINING SUMMARY</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-3)" }}>Total Sessions</span>
                    <span style={{ fontWeight: 700 }}>{athleteStats.workout_summary?.total_sessions || 0}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-3)" }}>Total Volume</span>
                    <span style={{ fontWeight: 700 }}>{athleteStats.set_summary?.total_volume ? `${(athleteStats.set_summary.total_volume).toLocaleString()} kg` : "0 kg"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-3)" }}>Avg Duration</span>
                    <span style={{ fontWeight: 700 }}>{Math.round((athleteStats.workout_summary?.avg_duration_sec || 0) / 60)} min</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-3)" }}>Last Active</span>
                    <span style={{ fontWeight: 700 }}>{athleteStats.workout_summary?.last_session ? new Date(athleteStats.workout_summary.last_session).toLocaleDateString() : "Never"}</span>
                  </div>
                </div>
              </div>

              {/* RECENT WORKOUTS */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent)", marginBottom: 12 }}>
                  <Activity size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>RECENT WORKOUTS</span>
                </div>
                {athleteStats.recent_workouts?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 150, overflowY: "auto", paddingRight: 4 }}>
                    {athleteStats.recent_workouts.map(w => (
                      <div
                        key={w.id}
                        onClick={() => {
                          setSelectedWorkoutDetail(w);
                          api.getSessionNotes(w.id).then(res => setSessionNotes(res || [])).catch(() => { });
                        }}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: 4 }}
                      >
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: 8 }}>
                          <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{w.workout_name}</div>
                          <div style={{ fontSize: 10, color: "var(--color-text-3)", marginTop: 2 }}>{new Date(w.session_date).toLocaleDateString()}</div>
                        </div>
                        <span style={{ color: "var(--aura-cyan)", fontWeight: 700, fontSize: 11 }}>{Math.round(w.volume)} kg</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No recent workouts logged.</div>
                )}
              </div>

              {/* NUTRITION & TARGET COMPLIANCE */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#22c55e", marginBottom: 12 }}>
                  <Heart size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>NUTRITION TARGET COMPLIANCE</span>
                </div>
                {nutritionTarget ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--color-text-3)", display: "flex", justifyContent: "space-between" }}>
                      <span>Goal: <span style={{ color: "#fff", fontWeight: 700 }}>{nutritionTarget.goal}</span></span>
                      {nutritionTarget.goal === 'Coach Assigned' && (
                        <span style={{ color: "var(--aura-cyan)", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Active Coach Plan</span>
                      )}
                    </div>

                    {/* Calories Progress */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span>Calories (7-day avg)</span>
                        <span>{avgCal} / {Math.round(nutritionTarget.final_calories)} kcal</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min((avgCal / nutritionTarget.final_calories) * 100, 100)}%`, background: "var(--aura-accent)", borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Protein Progress */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span>Protein</span>
                        <span>{avgProt}g / {Math.round(nutritionTarget.final_protein)}g</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min((avgProt / nutritionTarget.final_protein) * 100, 100)}%`, background: "#f59e0b", borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Carbs Progress */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span>Carbohydrates</span>
                        <span>{avgCarb}g / {Math.round(nutritionTarget.final_carbs)}g</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min((avgCarb / nutritionTarget.final_carbs) * 100, 100)}%`, background: "var(--aura-cyan)", borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Fats Progress */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span>Fats</span>
                        <span>{avgFat}g / {Math.round(nutritionTarget.final_fat)}g</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min((avgFat / nutritionTarget.final_fat) * 100, 100)}%`, background: "#ec4899", borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No active nutrition target macros.</div>
                )}
              </div>

              {/* SLEEP & RECOVERY */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent)", marginBottom: 12 }}>
                  <Activity size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>SLEEP & RECOVERY</span>
                </div>
                {avgSleep ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 20 }}>
                      <div>
                        <span style={{ fontSize: 11, color: "var(--color-text-3)" }}>Sleep Avg</span>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{avgSleep} hrs</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: "var(--color-text-3)" }}>Quality Avg</span>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{avgQuality}/5 ★</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                      {athleteStats.recent_sleep.slice(0, 2).map((s, i) => (
                        <div key={i} style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                          {new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}: {s.hours}h ({s.quality}/5)
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No recent sleep logs.</div>
                )}
              </div>

              {/* BODYWEIGHT HISTORY */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent2)", marginBottom: 12 }}>
                  <TrendingUp size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>WEIGHT LOGS</span>
                </div>
                {athleteStats.recent_weights?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {athleteStats.recent_weights.slice(0, 4).map((w, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: 4 }}>
                        <span>{new Date(w.logged_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <span style={{ fontWeight: 800 }}>{w.weight_kg} kg</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No weight logs found.</div>
                )}
              </div>

              {/* PERSONAL RECORDS (PRs) */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20, gridColumn: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent)", marginBottom: 12 }}>
                  <Award size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>BEST LIFTS (PRs)</span>
                </div>
                {athleteStats.personal_records?.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {athleteStats.personal_records.slice(0, 6).map((pr, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{pr.exercise_name}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>{pr.weight_kg} kg × {pr.reps} reps</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--aura-accent)" }}>
                          {Math.round(pr.one_rm_est)} kg <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-text-3)" }}>1RM</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No personal records established.</div>
                )}
              </div>

              {/* WEEKLY CONSISTENCY */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-cyan)", marginBottom: 12 }}>
                  <Activity size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>WEEKLY CONSISTENCY (LAST 8 WEEKS)</span>
                </div>
                {athleteStats.weekly_sessions?.length > 0 ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    {athleteStats.weekly_sessions.map((w, idx) => {
                      const count = w.sessions || 0;
                      const weekLabel = new Date(w.week).toLocaleDateString([], { month: 'short', day: 'numeric' });
                      const colors = ["rgba(255,255,255,0.03)", "rgba(6, 182, 212, 0.15)", "rgba(6, 182, 212, 0.4)", "rgba(6, 182, 212, 0.8)"];
                      const blockColor = colors[Math.min(count, 3)];
                      return (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 6 }}>
                          <div style={{
                            width: "100%", height: 32, borderRadius: 8, background: blockColor,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 800, color: count > 1 ? "#000" : "var(--color-text-2)",
                            border: "1px solid rgba(255,255,255,0.03)"
                          }} title={`${count} workouts in week of ${weekLabel}`}>
                            {count}
                          </div>
                          <span style={{ fontSize: 9, color: "var(--color-text-3)", whiteSpace: "nowrap" }}>{weekLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No session history logged.</div>
                )}
              </div>

              {/* MUSCLE DISTRIBUTION */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent)", marginBottom: 12 }}>
                  <Dumbbell size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>MUSCLE VOLUME DISTRIBUTION</span>
                </div>
                {athleteStats.muscle_distribution?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                    {athleteStats.muscle_distribution.map((m, idx) => {
                      const maxCount = Math.max(...athleteStats.muscle_distribution.map(d => d.count), 1);
                      const percentage = (m.count / maxCount) * 100;
                      return (
                        <div key={idx}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                            <span style={{ textTransform: "capitalize", fontWeight: 700, color: "var(--color-text-2)" }}>{m.muscle_group}</span>
                            <span style={{ color: "var(--color-text-3)", fontSize: 10 }}>{m.count} sets</span>
                          </div>
                          <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${percentage}%`, background: "var(--aura-accent)", borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No muscle training data logged.</div>
                )}
              </div>

              {/* BODY MEASUREMENTS */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent3)", marginBottom: 12 }}>
                  <Activity size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>BODY MEASUREMENTS HISTORY</span>
                </div>
                {athleteStats.measurements?.length > 0 ? (
                  <div style={{ overflowX: "auto", maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--color-text-3)" }}>
                          <th style={{ padding: "6px 2px" }}>Date</th>
                          <th style={{ padding: "6px 2px" }}>Waist</th>
                          <th style={{ padding: "6px 2px" }}>Chest</th>
                          <th style={{ padding: "6px 2px" }}>Arms (L/R)</th>
                          <th style={{ padding: "6px 2px" }}>Thighs (L/R)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {athleteStats.measurements.slice(0, 5).map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", color: "var(--color-text-2)" }}>
                            <td style={{ padding: "6px 2px", fontWeight: 700 }}>{new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
                            <td style={{ padding: "6px 2px" }}>{m.waist || "-"} cm</td>
                            <td style={{ padding: "6px 2px" }}>{m.chest || "-"} cm</td>
                            <td style={{ padding: "6px 2px" }}>{m.left_arm || "-"}/{m.right_arm || "-"}</td>
                            <td style={{ padding: "6px 2px" }}>{m.left_thigh || "-"}/{m.right_thigh || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No body measurements logged.</div>
                )}
              </div>

              {/* PROGRESS PHOTOS TIMELINE */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20, gridColumn: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-cyan)", marginBottom: 12 }}>
                  <Camera size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>PROGRESS PHOTOS TIMELINE</span>
                </div>
                {athleteStats.progress_photos?.length > 0 ? (
                  <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "thin" }}>
                    {athleteStats.progress_photos.map((photo, idx) => (
                      <div key={idx} style={{
                        flexShrink: 0, width: 140, background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border-card)", borderRadius: 12, overflow: "hidden",
                        display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8
                      }}>
                        <div style={{ width: "100%", height: 140, background: "#111", overflow: "hidden" }}>
                          <img
                            src={resolveBackendUrl(photo.photo_url)}
                            alt={`Progress on ${photo.date}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => { e.target.src = "https://placehold.co/140x140?text=No+Photo"; }}
                          />
                        </div>
                        <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 800 }}>{new Date(photo.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          {photo.weight && <span style={{ fontSize: 10, color: "var(--aura-accent2)", fontWeight: 700 }}>{photo.weight} kg</span>}
                          {photo.note && (
                            <span style={{ fontSize: 9, color: "var(--color-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={photo.note}>
                              {photo.note}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No progress photos uploaded yet.</div>
                )}
              </div>

              {/* COACH CHECK-INS HISTORY */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 16, padding: 20, gridColumn: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent)", marginBottom: 12 }}>
                  <ClipboardList size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em" }}>COACH CHECK-INS & REVIEWS</span>
                </div>
                {athleteStats.check_ins?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {athleteStats.check_ins.map((c, idx) => (
                      <div key={idx} style={{
                        background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-card)",
                        borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text)" }}>
                            Review on {new Date(c.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 800,
                              background: c.status_label === 'on_track' ? "rgba(34, 197, 94, 0.1)" : c.status_label === 'needs_focus' ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)",
                              color: c.status_label === 'on_track' ? "#22C55E" : c.status_label === 'needs_focus' ? "#f59e0b" : "#EF4444"
                            }}>
                              {c.status_label.replace('_', ' ').toUpperCase()}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)" }}>Adherence: {c.adherence_rate}%</span>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-2)", lineHeight: 1.5 }}>{c.feedback}</p>
                        {c.focus_areas && c.focus_areas.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" }}>
                            <span style={{ fontSize: 10, color: "var(--color-text-3)", fontWeight: 700 }}>FOCUS AREAS:</span>
                            {c.focus_areas.map((area, i) => (
                              <span key={i} className="glass-pill" style={{ fontSize: 9, padding: "2px 8px", background: "rgba(6, 182, 212, 0.05)", border: "1px solid rgba(6, 182, 212, 0.1)" }}>
                                {area}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--color-text-3)", fontStyle: "italic" }}>No check-in reviews logged yet. Click "Log Review" to submit your first review.</div>
                )}
              </div>
            </div>

            {/* Right Column: Client Interactive Body Silhouette Heatmap */}
            <div style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid var(--border-card)",
              borderRadius: 20,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              position: "sticky",
              top: 20,
              minWidth: 0,
              maxWidth: "100%",
              boxSizing: "border-box",
              overflow: "hidden"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--aura-accent)", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 10 }}>
                <Activity size={18} /> <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>CLIENT BODY MAP</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-3)", lineHeight: 1.4 }}>
                Visual heatmap showing muscle group tracking status (Green/Cyan) and active coach-logged injuries (Orange/Red).
              </p>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <BodyMapWidget
                  latestProp={athleteStats.measurements?.[0] || {}}
                  previousProp={athleteStats.measurements?.[1] || {}}
                  injuriesProp={(athleteStats.active_injuries || []).map(i => ({ ...i, status: 'active' }))}
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-3)" }}>No stats available for this athlete.</div>
        )}

      </div>
    );
  };

  const activeOrPending = coaches.filter(c => c.status === 'active' || c.status === 'pending');
  const browseCoaches = coaches.filter(c => !c.status || c.status === 'declined');
  const isCoachUser = user?.role === 'coach' || user?.profile?.role === 'coach' || role === 'coach';
  const isCoachApproved = profile
    ? Boolean(profile.verification_status === "approved" || (!profile.verification_status && (profile.approved || profile.coach_verified)))
    : Boolean(user?.verification_status === "approved" || (!user?.verification_status && (user?.approved || user?.coach_verified)));

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60, background: "var(--color-bg)", paddingTop: 24 }}>
      <div className="page-inner" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--color-text-3)", padding: 60 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Loading workspace...</div>
          </div>
        ) : isCoachUser && !isCoachApproved ? (
          renderCoachOnboarding()
        ) : isCoachUser ? (
          <RequireCoachRole>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <CoachWorkspaceNav athleteCount={athletes.length} />

              {location.pathname.startsWith("/coach/schedule") ? (
                <ScheduleSection />
              ) : location.pathname.startsWith("/coach/ai-reports") ? (
                <AiReportsSection />
              ) : location.pathname.startsWith("/coach/events") ? (
                <EventsSection />
              ) : (
                <div>
                  {selectedAthlete ? renderAthleteDetail() : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      {/* Roster Top Options Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20, alignItems: "start" }}>
                        {/* Invite Section */}
                        <div style={{ background: "var(--bg-glass)", padding: 24, borderRadius: 24, border: "1px solid var(--border-card)", height: "100%" }}>
                          <h2 style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--color-text)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                            <UserPlus size={18} color="var(--aura-accent)" /> Invite Athlete
                          </h2>
                          <form onSubmit={handleInvite} style={{ display: "flex", gap: 12, flexDirection: "column" }}>
                            <div style={{ position: "relative" }}>
                              <Search size={16} color="var(--color-text-3)" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
                              <input
                                type="text"
                                className="themed-input"
                                value={inviteIdentifier}
                                onChange={e => setInviteIdentifier(e.target.value)}
                                placeholder="Athlete's email or nickname"
                                style={{ width: "100%", paddingLeft: 40, height: 48, borderRadius: 14 }}
                                required
                              />
                            </div>
                            <button type="submit" className="btn-primary" style={{ borderRadius: 14, fontWeight: 700, height: 48 }}>
                              Send Invite
                            </button>
                          </form>
                          {inviteStatus && (
                            <div style={{
                              marginTop: 16, fontSize: 13, padding: "12px 16px", borderRadius: 12, fontWeight: 600,
                              background: inviteStatus.type === "error" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
                              color: inviteStatus.type === "error" ? "#EF4444" : "#22C55E",
                              border: `1px solid ${inviteStatus.type === "error" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)"}`
                            }}>
                              {inviteStatus.msg}
                            </div>
                          )}
                        </div>

                        {/* Manage Gym Locations */}
                        <div style={{ background: "var(--bg-glass)", padding: 24, borderRadius: 24, border: "1px solid var(--border-card)", height: "100%" }}>
                          <h2 style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--color-text)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                            <Activity size={18} color="var(--aura-cyan)" /> Manage Gym Locations
                          </h2>
                          <p style={{ fontSize: 12, color: "var(--color-text-3)", margin: "0 0 16px" }}>
                            Select the gyms in Tunisia where you actively train/coach clients.
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 150, overflowY: "auto", paddingRight: 8 }}>
                            {gyms.map(g => (
                              <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", color: "var(--color-text)" }}>
                                <input
                                  type="checkbox"
                                  checked={coachSelectedGyms.includes(g.id)}
                                  onChange={() => handleToggleGym(g.id)}
                                  style={{ accentColor: "var(--aura-cyan)" }}
                                />
                                <span>{g.name} <span style={{ fontSize: 11, color: "var(--color-text-3)" }}>({g.address})</span></span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Athlete List */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--color-text)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          <Users size={18} color="var(--color-text-3)" /> Active Athletes ({athletes.length})
                        </h2>

                        {athletes.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,0.02)", borderRadius: 24, border: "1px dashed var(--border-card)", color: "var(--color-text-3)" }}>
                            <div style={{ background: "rgba(255,255,255,0.05)", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                              <Users size={32} opacity={0.5} />
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>No Athletes Yet</div>
                            <div style={{ fontSize: 14 }}>Send an invite above to start coaching.</div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                            {athletes.map(a => (
                              <div
                                key={a.relationship_id}
                                onClick={() => a.status === 'active' && loadAthleteStats(a)}
                                style={{
                                  background: "var(--bg-glass)", border: "1px solid var(--border-card)", borderRadius: 20,
                                  padding: 20, cursor: a.status === 'active' ? "pointer" : "default",
                                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                  position: "relative", overflow: "hidden"
                                }}
                                onMouseEnter={e => {
                                  if (a.status === 'active') {
                                    e.currentTarget.style.transform = "translateY(-4px)";
                                    e.currentTarget.style.borderColor = "var(--aura-accent)";
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (a.status === 'active') {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.borderColor = "var(--border-card)";
                                  }
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                                  <div style={{
                                    width: 48, height: 48, borderRadius: 16, background: "var(--bg-card)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 18, fontWeight: 800, color: "var(--color-text)", overflow: "hidden"
                                  }}>
                                    {a.avatar_url ? (
                                      <img src={a.avatar_url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      (a.name || a.email || 'A').charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: 16, color: "var(--color-text)" }}>{a.name || a.email.split('@')[0]}</div>
                                    <div style={{ fontSize: 12, color: "var(--color-text-3)", marginTop: 2 }}>{a.email}</div>
                                  </div>
                                </div>

                                {a.status === 'pending' ? (
                                  a.initiated_by === 'athlete' ? (
                                    <div style={{ display: "flex", gap: 8 }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleResponse(a.relationship_id, 'accept'); }}
                                        className="btn-primary"
                                        style={{
                                          flex: 1,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 6,
                                          padding: "6px 0",
                                          borderRadius: 8,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          height: 36,
                                          width: "auto"
                                        }}
                                      >
                                        <Check size={14} /> Accept Request
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleResponse(a.relationship_id, 'decline'); }}
                                        style={{
                                          flex: 1,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 6,
                                          padding: "6px 0",
                                          background: "rgba(255,255,255,0.05)",
                                          border: "1px solid var(--border-card)",
                                          color: "#fff",
                                          borderRadius: 8,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          height: 36,
                                          cursor: "pointer"
                                        }}
                                      >
                                        <X size={14} /> Decline
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(234, 179, 8, 0.1)", color: "#EAB308", padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                                      <AlertCircle size={14} /> Invite Pending (Waiting for Athlete)
                                    </div>
                                  )
                                ) : (
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}>
                                    <div style={{ display: "flex", gap: 24 }}>
                                      <div>
                                        <div style={{ fontSize: 10, color: "var(--color-text-3)", fontWeight: 800, marginBottom: 2 }}>SESSIONS</div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)" }}>{a.total_sessions}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: "var(--color-text-3)", fontWeight: 800, marginBottom: 2 }}>LAST ACTIVE</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{a.last_session ? new Date(a.last_session).toLocaleDateString() : "Never"}</div>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleKickAthlete(a.relationship_id, a.name);
                                        }}
                                        style={{
                                          background: "rgba(239, 68, 68, 0.1)",
                                          color: "#EF4444",
                                          border: "none",
                                          padding: "6px 12px",
                                          borderRadius: "8px",
                                          fontSize: "11px",
                                          fontWeight: "700",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4
                                        }}
                                      >
                                        <X size={12} /> Kick
                                      </button>
                                      <ChevronRight size={20} color="var(--color-text-3)" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </RequireCoachRole>
        ) : location.pathname.startsWith("/coach/events") ? (
          <EventsSection />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Active Coaches */}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8, color: "var(--color-text)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                <Users size={18} color="var(--color-text-3)" /> Your Coach
              </h2>

              {activeOrPending.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,0.02)", borderRadius: 24, border: "1px dashed var(--border-card)", color: "var(--color-text-3)" }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Users size={32} opacity={0.5} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>No Coach Assigned</div>
                  <div style={{ fontSize: 14 }}>Browse the list below to hire a coach.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {activeOrPending.map(c => (
                    <div key={c.relationship_id} style={{
                      background: "var(--bg-glass)", border: "1px solid var(--border-card)", borderRadius: 20,
                      padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: 16, background: "var(--bg-card)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20, fontWeight: 800, color: "var(--aura-accent)", overflow: "hidden"
                        }}>
                          {c.coach_avatar ? (
                            <img src={c.coach_avatar} alt={c.coach_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            (c.coach_name || c.coach_email || 'C').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--color-text)" }}>{c.coach_name || c.coach_email.split('@')[0]}</div>
                          <div style={{ fontSize: 13, color: "var(--color-text-3)", marginTop: 2 }}>{c.coach_email}</div>
                        </div>
                      </div>

                      {c.status === 'pending' ? (
                        c.initiated_by === 'coach' ? (
                          <div style={{ display: "flex", gap: 12 }}>
                            <button onClick={() => handleResponse(c.relationship_id, 'accept')} className="btn-primary" style={{
                              display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, fontWeight: 700, fontSize: 13, height: 36, width: "auto"
                            }}>
                              <Check size={16} /> Accept Invite
                            </button>
                            <button onClick={() => handleResponse(c.relationship_id, 'decline')} style={{
                              display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12,
                              background: "transparent", color: "var(--color-text)", border: "1px solid var(--border-card)", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 36
                            }}>
                              <X size={16} /> Decline
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(234, 179, 8, 0.1)", color: "#EAB308", padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                            <AlertCircle size={16} /> Request Pending (Waiting for Coach Approval)
                          </div>
                        )
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <button
                            onClick={() => setChatRecipient({ ...c, id: c.coach_id, name: c.coach_name, avatar_url: c.coach_avatar })}
                            className="btn-secondary"
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
                          >
                            <MessageSquare size={16} /> Chat
                          </button>
                          <button
                            onClick={() => setActiveVideoCall({ athleteId: user?.id || user?.user_id, coachId: c.coach_id, role: 'athlete' })}
                            className="btn-secondary"
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", border: "1px solid rgba(99, 102, 241, 0.3)" }}
                          >
                            <Video size={16} /> Video Call
                          </button>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34, 197, 94, 0.1)", color: "#22C55E", padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                            <Check size={16} /> Active Coach
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gym Map Explorer Section */}
            <div style={{
              background: "var(--bg-glass)",
              border: "1px solid var(--border-card)",
              borderRadius: 28,
              padding: 28,
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
              backdropFilter: "blur(16px)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 10, color: "var(--color-text)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    <MapPin size={20} color="var(--aura-cyan)" style={{ filter: "drop-shadow(0 0 4px var(--aura-cyan))" }} /> Gym & Coach Finder
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--color-text-3)", margin: "4px 0 0" }}>
                    Discover top fitness facilities in Tunisia and connect with their certified resident coaches.
                  </p>
                </div>

                <div style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-card)",
                  borderRadius: 12,
                  padding: "6px 12px",
                  fontSize: 11,
                  color: "var(--color-text-3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <Navigation size={12} color="var(--aura-accent)" />
                  Location: <span style={{ color: "#fff", fontWeight: 700 }}>{userLoc.lat.toFixed(4)}°N, {userLoc.lng.toFixed(4)}°E</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 24, width: "100%" }}>
                {/* Map Area */}
                <div style={{ flex: 1.7, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Region & Specialty Selectors */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {Object.entries(REGIONS).map(([key, reg]) => {
                        const isSelected = selectedRegion === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setSelectedRegion(key);
                              setUserLoc({ lat: reg.lat, lng: reg.lng });
                            }}
                            style={{
                              background: isSelected ? "var(--aura-cyan, #06b6d4)" : "rgba(255, 255, 255, 0.05)",
                              color: isSelected ? "#090e17" : "var(--color-text, #f8fafc)",
                              border: isSelected ? "1px solid var(--aura-cyan, #06b6d4)" : "1px solid var(--border-card, rgba(255, 255, 255, 0.1))",
                              padding: "8px 18px",
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                              boxShadow: isSelected ? "0 0 16px rgba(6, 182, 212, 0.45)" : "none"
                            }}
                            onMouseEnter={e => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                                e.currentTarget.style.color = "#ffffff";
                              }
                            }}
                            onMouseLeave={e => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                                e.currentTarget.style.color = "var(--color-text, #f8fafc)";
                              }
                            }}
                          >
                            {reg.name}
                          </button>
                        );
                      })}
                    </div>

                    <select
                      value={selectedGoal}
                      onChange={(e) => setSelectedGoal(e.target.value)}
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "var(--color-text, #f8fafc)",
                        border: "1px solid var(--border-card, rgba(255, 255, 255, 0.1))",
                        padding: "8px 16px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        outline: "none",
                        minWidth: 160
                      }}
                    >
                      <option value="all" style={{ background: "#0f172a", color: "#ffffff" }}>All Specialties</option>
                      {Object.entries(GOAL_LABELS).map(([key, label]) => (
                        <option key={key} value={key} style={{ background: "#0f172a", color: "#ffffff" }}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Leaflet Map Widget */}
                  <div
                    id="leaflet-coaches-map"
                    style={{
                      height: 560,
                      width: "100%",
                      borderRadius: 20,
                      border: "1px solid var(--border-card)",
                      boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
                      background: "#111",
                      overflow: "hidden"
                    }}
                  />
                </div>

                {/* Sidebar Directory */}
                <div style={{ flex: 1.3, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 900, margin: "0 0 4px", color: "var(--color-text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Gym Directory ({nearestGyms.length} Facilities)
                  </h4>

                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    maxHeight: 560,
                    overflowY: "auto",
                    paddingRight: 10
                  }}>
                    {nearestGyms.map(g => (
                      <div
                        key={g.id}
                        style={{
                          background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
                          border: "1px solid var(--border-card)",
                          borderRadius: 20,
                          padding: 16,
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = "var(--border-focus)";
                          e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.02) 100%)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "var(--border-card)";
                          e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)";
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)" }}>{g.name}</div>
                            <div style={{ fontSize: 11, color: "var(--color-text-3)", marginTop: 2 }}>{g.address}</div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <div style={{
                              background: "rgba(6, 182, 212, 0.08)",
                              color: "var(--aura-cyan)",
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "4px 10px",
                              borderRadius: 8,
                              border: "1px solid rgba(6, 182, 212, 0.15)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4
                            }}>
                              <Navigation size={10} /> {g.distance.toFixed(1)} km
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${g.latitude},${g.longitude}`, "_blank");
                              }}
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                color: "var(--color-text-2)",
                                border: "1px solid var(--border-card)",
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontSize: 9,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                            >
                              Directions
                            </button>
                          </div>
                        </div>

                        {g.coaches && g.coaches.length > 0 ? (
                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            marginTop: 12,
                            borderTop: "1px solid rgba(255,255,255,0.04)",
                            paddingTop: 12
                          }}>
                            {g.coaches.map(c => {
                              // Find if athlete has existing coach connection/status in coaches list
                              const match = coaches.find(curr => curr.coach_id === c.coach_id);
                              const isHired = match?.status === 'active';
                              const isPending = match?.status === 'pending';

                              return (
                                <div
                                  key={c.coach_id}
                                  onClick={() => setSelectedCoachForInfo(c)}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    padding: "6px 8px",
                                    borderRadius: "12px",
                                    transition: "background 0.2s",
                                    gap: 12
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 10,
                                      background: "var(--color-surface-h)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 14,
                                      fontWeight: 900,
                                      color: "var(--aura-cyan)",
                                      overflow: "hidden",
                                      border: "1px solid var(--border-card)",
                                      flexShrink: 0
                                    }}>
                                      {c.avatar_url ? (
                                        <img src={c.avatar_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      ) : (
                                        (c.name || c.email || 'C').charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {c.name || c.email.split('@')[0]}
                                      </div>
                                      <div style={{ fontSize: 9, color: "var(--color-text-3)", marginTop: 2, lineHeight: 1.3 }}>
                                        {(EXP_LABELS[c.experience?.toLowerCase()] || c.experience || 'TRAINER').toUpperCase()} • {(GOAL_LABELS[c.goal?.toLowerCase()] || c.goal || 'FITNESS').toUpperCase()}
                                      </div>
                                    </div>
                                  </div>

                                  {isHired ? (
                                    <div style={{
                                      background: "rgba(34, 197, 94, 0.08)",
                                      color: "#22c55e",
                                      fontSize: 11,
                                      fontWeight: 800,
                                      padding: "4px 10px",
                                      borderRadius: 8,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      flexShrink: 0
                                    }}>
                                      <Check size={12} /> Active
                                    </div>
                                  ) : isPending ? (
                                    <div style={{
                                      background: "rgba(245, 158, 11, 0.08)",
                                      color: "#f59e0b",
                                      fontSize: 11,
                                      fontWeight: 800,
                                      padding: "4px 10px",
                                      borderRadius: 8,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      flexShrink: 0
                                    }}>
                                      <AlertCircle size={12} /> Pending
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleHireCoach(c.coach_id);
                                      }}
                                      className="btn-primary"
                                      style={{ padding: "6px 14px", borderRadius: 10, fontSize: 11, fontWeight: 800, flexShrink: 0, width: "auto" }}
                                    >
                                      Hire
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: "var(--color-text-3)", fontStyle: "italic", marginTop: 8 }}>
                            No resident coaches registered here.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Coach Directory */}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8, color: "var(--color-text)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                <Search size={18} color="var(--color-text-3)" /> Browse & Hire Coaches
              </h2>

              {browseCoaches.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>No other coaches listed.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {browseCoaches.map(c => {
                    const cRating = Number(c.rating || 4.8).toFixed(1);
                    const cReviews = c.review_count || 12;
                    const cAthletes = c.athletes_count || 18;
                    return (
                      <div key={c.coach_id}
                        onClick={() => setSelectedCoachForInfo(c)}
                        style={{
                          background: "var(--bg-glass)", border: "1px solid var(--border-card)", borderRadius: 20,
                          padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center",
                          cursor: "pointer", transition: "all 0.2s ease"
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--aura-accent)"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-card)"}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 48, height: 48, borderRadius: 14, background: "var(--bg-card)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, fontWeight: 800, color: "var(--aura-accent)", overflow: "hidden",
                            border: "1.5px solid rgba(6, 182, 212, 0.4)", flexShrink: 0
                          }}>
                            {c.coach_avatar ? (
                              <img src={c.coach_avatar} alt={c.coach_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              (c.coach_name || c.coach_email || 'C').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--color-text)" }}>{c.coach_name || c.coach_email.split('@')[0]}</div>

                            {/* Rating and Athletes stats */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>
                                <Star size={12} fill="#f59e0b" />
                                <span>{cRating}</span>
                                <span style={{ color: "var(--color-text-3)", fontSize: 10 }}>({cReviews})</span>
                              </div>

                              <span style={{ fontSize: 10, color: "var(--color-text-3)" }}>•</span>

                              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#38bdf8" }}>
                                <Users size={11} />
                                <span>{cAthletes} Athletes</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {c.is_suspended ? (
                          <span style={{
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "6px 12px",
                            borderRadius: 10
                          }}>
                            {c.suspended_until ? `Suspended (${new Date(c.suspended_until).toLocaleDateString()})` : "Suspended"}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHireCoach(c.coach_id);
                            }}
                            className="btn-primary"
                            style={{ padding: "6px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, width: "auto" }}
                          >
                            Hire
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {showSuggestModal && selectedAthlete && (
        <SuggestWorkoutModal
          athlete={selectedAthlete}
          onClose={() => setShowSuggestModal(false)}
          onSuggest={() => {
            setShowSuggestModal(false);
          }}
        />
      )}

      {chatRecipient && (
        <CoachChatModal
          recipient={chatRecipient}
          onClose={() => setChatRecipient(null)}
        />
      )}

      {activeVideoCall && (
        <VideoCallScreen
          athleteId={activeVideoCall.athleteId}
          coachId={activeVideoCall.coachId}
          currentUserId={user?.id || user?.user_id}
          currentUserName={user?.name || user?.nickname || user?.display_name || user?.full_name || 'Coach'}
          currentUserAvatar={user?.avatar_url || user?.profile?.avatar_url}
          userRole={activeVideoCall.role}
          mode="caller"  /* ← CALLER: getOrCreate + join + send invite signal */
          onCallEnd={() => setActiveVideoCall(null)}
        />
      )}

      {showNutritionModal && selectedAthlete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)", zIndex: 1100, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div style={{
            background: "var(--color-bg)", border: "1px solid var(--border-card)",
            borderRadius: 24, padding: 30, maxWidth: 440, width: "100%",
            display: "flex", flexDirection: "column", gap: 20, position: "relative",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <button
              onClick={() => setShowNutritionModal(false)}
              style={{
                position: "absolute", top: 20, right: 20,
                background: "rgba(255,255,255,0.05)", border: "none", color: "#fff",
                width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
              }}
            >
              ×
            </button>

            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--color-text)", fontWeight: 800 }}>Assign Nutrition Targets</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-3)" }}>
                Directly override target macronutrients for {selectedAthlete.name || selectedAthlete.email}.
              </p>
            </div>

            <form onSubmit={handleAssignNutrition} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>Target Calories (kcal)</label>
                <input
                  type="number"
                  value={nutrCal}
                  onChange={e => setNutrCal(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13 }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>Protein (g)</label>
                  <input
                    type="number"
                    value={nutrProt}
                    onChange={e => setNutrProt(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13 }}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>Carbs (g)</label>
                  <input
                    type="number"
                    value={nutrCarb}
                    onChange={e => setNutrCarb(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13 }}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>Fats (g)</label>
                  <input
                    type="number"
                    value={nutrFat}
                    onChange={e => setNutrFat(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ marginTop: 10, height: 40, borderRadius: 10, fontWeight: 800, fontSize: 13 }}
                disabled={submittingNutrition}
              >
                {submittingNutrition ? "Saving targets..." : "Assign Target Plan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCheckInModal && selectedAthlete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)", zIndex: 1100, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div style={{
            background: "var(--color-bg)", border: "1px solid var(--border-card)",
            borderRadius: 24, padding: 30, maxWidth: 500, width: "100%", maxHeight: "90vh",
            overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, position: "relative",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <button
              onClick={() => setShowCheckInModal(false)}
              style={{
                position: "absolute", top: 20, right: 20,
                background: "rgba(255,255,255,0.05)", border: "none", color: "#fff",
                width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
              }}
            >
              ×
            </button>

            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--color-text)", fontWeight: 800 }}>Log Weekly Review</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-3)" }}>
                Submit a training & nutrition review checklist for {selectedAthlete.name || selectedAthlete.email}.
              </p>
            </div>

            <form onSubmit={handleSubmitCheckIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Adherence Rate slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>Client Weekly Adherence</label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--aura-cyan)" }}>{checkInAdherence}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={checkInAdherence}
                  onChange={e => setCheckInAdherence(e.target.value)}
                  style={{ width: "100%", accentColor: "var(--aura-cyan)" }}
                />
              </div>

              {/* Status indicator */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>Status Assessment</label>
                <select
                  value={checkInStatus}
                  onChange={e => setCheckInStatus(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.02)", color: "#fff", border: "1px solid var(--border-card)",
                    borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none", cursor: "pointer"
                  }}
                >
                  <option value="on_track" style={{ background: "#111" }}>On Track & Advancing</option>
                  <option value="needs_focus" style={{ background: "#111" }}>Needs Adjustment / Focus</option>
                  <option value="off_track" style={{ background: "#111" }}>Off Track / Critical Review</option>
                </select>
              </div>

              {/* Feedback text */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>Progress Review & Feedback</label>
                <textarea
                  placeholder="Analyze their fatigue levels, sleep compliance, weight trends, and specify technique adjustments..."
                  value={checkInFeedback}
                  onChange={e => setCheckInFeedback(e.target.value)}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)",
                    borderRadius: 10, padding: 12, color: "#fff", fontSize: 13, minHeight: 80, resize: "none"
                  }}
                  required
                />
              </div>

              {/* Focus areas */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-2)" }}>Next Week's Focus Areas (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Sleep 8h+, High protein, Bench technique, Load progression"
                  value={checkInFocusAreas}
                  onChange={e => setCheckInFocusAreas(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13 }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ marginTop: 10, height: 40, borderRadius: 10, fontWeight: 800, fontSize: 13 }}
                disabled={submittingCheckIn}
              >
                {submittingCheckIn ? "Logging review..." : "Submit Review Log"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedCoachForInfo && (
        <CoachProfileModal
          coach={selectedCoachForInfo}
          onClose={() => setSelectedCoachForInfo(null)}
          onHireCoach={handleHireCoach}
        />
      )}

      {selectedWorkoutDetail && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{
            background: "var(--color-bg)", border: "1px solid var(--border-card)",
            borderRadius: 24, padding: 30, maxWidth: 600, width: "100%", maxHeight: "90vh",
            overflowY: "auto", display: "flex", flexDirection: "column", gap: 20
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, color: "var(--color-text)", fontWeight: 800 }}>{selectedWorkoutDetail.workout_name}</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-3)" }}>{new Date(selectedWorkoutDetail.session_date).toLocaleDateString()} • {Math.round(selectedWorkoutDetail.duration_sec / 60)} mins</span>
              </div>
              <button
                onClick={() => { setSelectedWorkoutDetail(null); setSessionNotes([]); }}
                style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 12, textAlign: "center", border: "1px solid var(--border-card)" }}>
                <span style={{ fontSize: 11, color: "var(--color-text-3)" }}>TOTAL VOLUME</span>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: "var(--aura-accent)" }}>{selectedWorkoutDetail.total_volume} kg</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 12, textAlign: "center", border: "1px solid var(--border-card)" }}>
                <span style={{ fontSize: 11, color: "var(--color-text-3)" }}>TOTAL SETS</span>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: "var(--aura-accent)" }}>{selectedWorkoutDetail.total_sets} sets</div>
              </div>
            </div>

            {selectedWorkoutDetail.notes && (
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 16, border: "1px solid var(--border-card)" }}>
                <span style={{ fontSize: 11, color: "var(--color-text-3)", fontWeight: 700 }}>Client Session Notes:</span>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-text)", lineHeight: 1.4 }}>{selectedWorkoutDetail.notes}</p>
              </div>
            )}

            <div>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>Exercises & Sets</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.entries(selectedWorkoutDetail.sets.reduce((groups, s) => {
                  const name = s.exercise_name || "Unknown";
                  if (!groups[name]) groups[name] = [];
                  groups[name].push(s);
                  return groups;
                }, {})).map(([name, exSets]) => (
                  <div key={name} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-card)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: "var(--color-text)" }}>{name}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {exSets.map((s, idx) => (
                        <div key={s.id || idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-3)" }}>
                          <span>Set {idx + 1} ({s.set_type || "normal"})</span>
                          <span style={{ color: "var(--color-text)", fontWeight: 700 }}>
                            {s.weight_kg} kg × {s.reps} reps {s.rpe ? `(RPE ${s.rpe})` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-card)", paddingTop: 20 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--aura-accent)", display: "flex", alignItems: "center", gap: 6 }}>
                <MessageSquare size={16} /> Coach Feedback & Recommendations
              </h4>

              {sessionNotes.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {sessionNotes.map(n => (
                    <div key={n.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: 12, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-3)", marginBottom: 4 }}>
                        <span>{n.coach_name || "Coach"}</span>
                        <span>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--color-text)", lineHeight: 1.4 }}>{n.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--color-text-3)", fontStyle: "italic", marginBottom: 16 }}>No feedback note left on this session yet.</p>
              )}

              {role === 'coach' && (
                <form onSubmit={handleAddSessionNote} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <textarea
                    placeholder="Leave feedback or recommendations for this session..."
                    value={newSessionNote}
                    onChange={e => setNewSessionNote(e.target.value)}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)",
                      borderRadius: 12, padding: 12, color: "var(--color-text)", fontSize: 13, minHeight: 70, resize: "none"
                    }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={submittingNote || !newSessionNote.trim()}
                    className="btn-primary"
                    style={{ alignSelf: "flex-end", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}
                  >
                    {submittingNote ? "Submitting..." : "Add Feedback"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple internal icon component for missing Lucide icon
function TrendingUpIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trending-up">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
