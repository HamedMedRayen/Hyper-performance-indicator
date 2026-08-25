import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Check, X, Search, Activity,
  ChevronRight, Dumbbell, Calendar, AlertCircle,
  MessageSquare, Send, ArrowLeft, Plus, Trash2, Award, Heart, ShieldAlert, FileText, MapPin, Star, Sliders, TrendingUp, Trophy, Flag
} from "lucide-react";
import L from "../../utils/leafletSetup";
import { resolveBackendUrl } from "../../utils/config";
import { useToast } from "../../components/common/Toast";
import { fmt } from "../../utils/formatters";
import { useAuth } from "../../utils/auth";
import CoachProfileModal from "../../components/modals/CoachProfileModal";
import ReportCoachModal from "../../components/modals/ReportCoachModal";
import MobileCoachWorkspaceNav from "../components/MobileCoachWorkspaceNav";
import RequireCoachRole from "../../components/auth/RequireCoachRole";
import ScheduleSection from "../../components/coach/ScheduleSection";
import AiReportsSection from "../../components/coach/AiReportsSection";
import EventsSection from "../../components/coach/EventsSection";
import MobileGymMap from "../components/MobileGymMap";

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

export default function MobileCoachingZone() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [role, setRole] = useState("athlete");
  const [activeTab, setActiveTab] = useState("my-coach"); // 'roster' | 'my-coach'
  const [athletes, setAthletes] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [selectedCoachForInfo, setSelectedCoachForInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Onboarding States
  const [onboardSpecialty, setOnboardSpecialty] = useState("muscle_gain");
  const [onboardExperience, setOnboardExperience] = useState("beginner");
  const [onboardAge, setOnboardAge] = useState(25);
  const [onboardSex, setOnboardSex] = useState("M");
  const [onboardBio, setOnboardBio] = useState("");
  const [onboardCVFile, setOnboardCVFile] = useState(null);
  const [onboardError, setOnboardError] = useState(null);
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);

  const [profile, setProfile] = useState(null);

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
      await fetchInitialData();
    } catch (err) {
      setOnboardError(err.message || "Failed to submit onboarding.");
    } finally {
      setOnboardSubmitting(false);
    }
  };

  const renderCoachOnboarding = () => {
    const isApproved = profile?.verification_status === "approved" || (!profile?.verification_status && (profile?.approved || profile?.coach_verified));
    const isPending = profile?.verification_status === "pending" || (!isApproved && Boolean(profile?.cv_url));
    const isRejected = profile?.verification_status === "rejected";

    if (isPending) {
      return (
        <div style={{
          background: "var(--bg-glass)", border: "1px solid var(--color-border)", borderRadius: 20,
          padding: 24, margin: "20px 0", textAlign: "center",
          boxShadow: "0 10px 25px rgba(0,0,0,0.3)"
        }}>
          <div style={{
            background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)",
            width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", color: "#f59e0b"
          }}>
            <ShieldAlert size={32} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: "0 0 8px" }}>Your Profile is Under Review</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 20px" }}>
            Thank you for submitting your CV. Our team is verifying your credentials. You will be notified and granted roster access once approved.
          </p>
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid var(--color-border)", borderRadius: 12,
            padding: 16, textAlign: "left", display: "flex", flexDirection: "column", gap: 8
          }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 4 }}>Submitted Info:</div>
            <div style={{ fontSize: 12, color: "var(--color-text)" }}>
              <strong>Specialty:</strong> {GOAL_LABELS[profile?.goal?.toLowerCase()] || profile?.goal?.toUpperCase() || "General Fitness"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text)" }}>
              <strong>Experience:</strong> {EXP_LABELS[profile?.experience?.toLowerCase()] || profile?.experience?.toUpperCase() || "Certified Instructor"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text)" }}>
              <strong>Age / Sex:</strong> {profile?.age || 25} years / {profile?.sex === 'M' ? 'Male' : 'Female'}
            </div>
            {profile?.bio && (
              <div style={{ fontSize: 12, color: "var(--color-text)" }}>
                <strong>Bio:</strong> {profile.bio}
              </div>
            )}
            {profile?.cv_url && (
              <div style={{ fontSize: 12, color: "var(--color-text)", wordBreak: "break-all" }}>
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
          background: "var(--bg-glass)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 20,
          padding: 24, margin: "20px 0", textAlign: "center",
          boxShadow: "0 10px 25px rgba(0,0,0,0.3)"
        }}>
          <div style={{
            background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)",
            width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", color: "#ef4444"
          }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: "0 0 8px" }}>Application Needs Revision</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 20px" }}>
            {profile?.rejection_reason || "Your verification documents could not be approved. Please review your credentials and resubmit updated verification documents below."}
          </p>
        </div>
      );
    }

    return (
      <div style={{
        background: "var(--bg-glass)", border: "1px solid var(--color-border)", borderRadius: 20,
        padding: 24, margin: "20px 0",
        boxShadow: "0 10px 25px rgba(0,0,0,0.3)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 16 }}>
          <div style={{
            background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.2)",
            width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--aura-cyan)"
          }}>
            <FileText size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: "#fff", margin: 0 }}>Coach Onboarding</h2>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0" }}>
              Submit credentials to list in the gym directory.
            </p>
          </div>
        </div>

        <form onSubmit={handleOnboardSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {onboardError && (
            <div style={{
              background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)",
              color: "#EF4444", fontSize: 12, padding: "10px 14px", borderRadius: 10, fontWeight: 600
            }}>
              {onboardError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Specialty</label>
            <select
              value={onboardSpecialty}
              onChange={e => setOnboardSpecialty(e.target.value)}
              style={{
                background: "var(--color-surface)", color: "#fff", border: "1px solid var(--color-border)",
                borderRadius: 10, padding: "10px 12px", fontSize: 12, outline: "none", cursor: "pointer"
              }}
            >
              {Object.entries(GOAL_LABELS).map(([key, val]) => (
                <option key={key} value={key} style={{ background: "#111" }}>{val}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Experience Level</label>
            <select
              value={onboardExperience}
              onChange={e => setOnboardExperience(e.target.value)}
              style={{
                background: "var(--color-surface)", color: "#fff", border: "1px solid var(--color-border)",
                borderRadius: 10, padding: "10px 12px", fontSize: 12, outline: "none", cursor: "pointer"
              }}
            >
              {Object.entries(EXP_LABELS).map(([key, val]) => (
                <option key={key} value={key} style={{ background: "#111" }}>{val}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Age (Years)</label>
              <input
                type="number"
                min="18"
                max="100"
                value={onboardAge}
                onChange={e => setOnboardAge(parseInt(e.target.value))}
                style={{
                  background: "var(--color-surface)", color: "#fff", border: "1px solid var(--color-border)",
                  borderRadius: 10, padding: "10px 12px", fontSize: 12, outline: "none"
                }}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Sex</label>
              <select
                value={onboardSex}
                onChange={e => setOnboardSex(e.target.value)}
                style={{
                  background: "var(--color-surface)", color: "#fff", border: "1px solid var(--color-border)",
                  borderRadius: 10, padding: "10px 12px", fontSize: 12, outline: "none", cursor: "pointer"
                }}
              >
                <option value="M" style={{ background: "#111" }}>Male</option>
                <option value="F" style={{ background: "#111" }}>Female</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Training Bio / Philosophy</label>
            <textarea
              value={onboardBio}
              onChange={e => setOnboardBio(e.target.value)}
              placeholder="Tell athletes about your certifications..."
              style={{
                background: "var(--color-surface)", color: "#fff", border: "1px solid var(--color-border)",
                borderRadius: 10, padding: "10px 12px", fontSize: 12, minHeight: 70, outline: "none", resize: "none"
              }}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Upload CV Document (PDF/Word/Image)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={e => setOnboardCVFile(e.target.files[0])}
              style={{
                background: "rgba(255,255,255,0.01)", color: "#fff", border: "1px dashed var(--color-border)",
                borderRadius: 10, padding: "12px", fontSize: 12, outline: "none", cursor: "pointer"
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={onboardSubmitting}
            className="btn-primary"
            style={{ padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 800, marginTop: 8 }}
          >
            {onboardSubmitting ? "Submitting Application..." : "Submit Verification Profile"}
          </button>
        </form>
      </div>
    );
  };

  // Invite states
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Selected Athlete states
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteStats, setAthleteStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Sub-views inside selected athlete: 'stats' | 'chat' | 'suggest'
  const [athleteSubView, setAthleteSubView] = useState("stats");

  // Clicked Workout Detail
  const [selectedWorkoutDetail, setSelectedWorkoutDetail] = useState(null);
  const [loadingWorkoutDetail, setLoadingWorkoutDetail] = useState(false);
  const [sessionNotes, setSessionNotes] = useState([]);
  const [newSessionNote, setNewSessionNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Fallback Tunisia Gyms (guarantees immediate display while API loads)
  const DEFAULT_TUNISIA_GYMS = [
    { id: 1, name: "California Gym (Lac 2)", address: "Les Berges du Lac 2, Tunis", latitude: 36.8475, longitude: 10.2652, coaches: [] },
    { id: 2, name: "California Gym (Ben Arous)", address: "Avenue de France, Ben Arous", latitude: 36.7533, longitude: 10.2223, coaches: [] },
    { id: 3, name: "California Gym (Ennasr)", address: "Avenue Hédi Nouira, Ennasr 2", latitude: 36.8576, longitude: 10.1704, coaches: [] },
    { id: 4, name: "Oxygen Gym (Megrine)", address: "Rue de la Gare, Megrine, Ben Arous", latitude: 36.7441, longitude: 10.2285, coaches: [] },
    { id: 5, name: "Giga Fit (Lac 1)", address: "Les Berges du Lac 1, Tunis", latitude: 36.8378, longitude: 10.2392, coaches: [] },
    { id: 6, name: "Titanium Gym (La Marsa)", address: "La Marsa, Tunis", latitude: 36.8858, longitude: 10.3228, coaches: [] },
    { id: 7, name: "Pro Fitness (Sousse)", address: "Route Touristique, Sousse", latitude: 35.8256, longitude: 10.6369, coaches: [] },
    { id: 8, name: "Gym Box (El Manar)", address: "El Manar 2, Tunis", latitude: 36.8329, longitude: 10.1492, coaches: [] },
    { id: 9, name: "California Gym (Sfax)", address: "Route de Teniour, Sfax", latitude: 34.7406, longitude: 10.7603, coaches: [] },
    { id: 10, name: "The Fit Loft (La Soukra)", address: "Avenue de l'UMA, La Soukra", latitude: 36.8647, longitude: 10.2238, coaches: [] }
  ];

  // Gym Finder states
  const [gyms, setGyms] = useState(DEFAULT_TUNISIA_GYMS);
  const [mapLoaded, setMapLoaded] = useState(true);
  const [userLoc, setUserLoc] = useState({ lat: 36.8065, lng: 10.1815 });
  const [nearestGyms, setNearestGyms] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("all");

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

  useEffect(() => {
    // Inject dark-mode map styles
    const styleId = 'leaflet-dark-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        #leaflet-coaches-map {
          background: #0f172a !important;
          z-index: 1;
        }
        .leaflet-popup-content-wrapper {
          background: #0f172a !important;
          color: #fff !important;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
        }
        .leaflet-popup-tip {
          background: #0f172a !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    api.getGyms().then(res => {
      if (res && res.length > 0) {
        setGyms(res);
      }
    }).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    const activeList = gyms.length ? gyms : DEFAULT_TUNISIA_GYMS;
    const computed = activeList.map(g => {
      const dist = calculateDistance(userLoc.lat, userLoc.lng, g.latitude, g.longitude);
      return { ...g, distance: dist };
    }).sort((a, b) => a.distance - b.distance);
    setNearestGyms(computed);
  }, [userLoc, gyms]);



  // Coach Chat states (for both coach chatting with athlete, or athlete chatting with coach)
  const [chattingWith, setChattingWith] = useState(null); // { id, name, avatar }
  const [reportingCoach, setReportingCoach] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);

  // Suggest Workout states
  const [programName, setProgramName] = useState("");
  const [programNote, setProgramNote] = useState("");
  const [suggestWorkouts, setSuggestWorkouts] = useState([{ name: "Day 1", exercises: [] }]);
  const [activeSuggestDay, setActiveSuggestDay] = useState(0);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [searchedExercises, setSearchedExercises] = useState([]);
  const [searchingExercises, setSearchingExercises] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, [location.pathname]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [vStatus, aths, coachesList] = await Promise.all([
        api.getCoachVerificationStatus().catch(() => null),
        api.getMyAthletes().catch(() => []),
        api.getAllCoaches().catch(() => [])
      ]);

      if (vStatus) {
        setProfile(vStatus);
        setRole(vStatus.role || "athlete");
        if (vStatus.role === "coach") {
          setActiveTab("roster");
        } else {
          setActiveTab("my-coach");
        }
      } else {
        const userRole = user?.role || user?.profile?.role || "athlete";
        setRole(userRole);
        if (userRole === "coach") {
          setActiveTab("roster");
        } else {
          setActiveTab("my-coach");
        }
      }

      setAthletes(aths || []);
      setCoaches(coachesList || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load coaching data");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteIdentifier.trim()) return;
    setInviteLoading(true);
    try {
      const res = await api.inviteAthlete(inviteIdentifier);
      toast.success(res.message || "Invitation sent successfully!");
      setInviteIdentifier("");
      // Refresh roster
      const aths = await api.getMyAthletes().catch(() => []);
      setAthletes(aths || []);
    } catch (err) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleHireCoach = async (coachId) => {
    try {
      const res = await api.hireCoach(coachId);
      toast.success(res.message || "Hire request sent to coach!");
      const coachesList = await api.getAllCoaches().catch(() => []);
      setCoaches(coachesList || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to send hire request");
    }
  };

  const handleResponse = async (relationshipId, action) => {
    try {
      await api.respondInvite(relationshipId, action);
      toast.success(`Request ${action}ed successfully.`);
      fetchInitialData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to respond to request");
    }
  };

  const handleKickAthlete = async (relationshipId, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from your roster?`)) return;
    try {
      await api.removeRelationship(relationshipId);
      setSelectedAthlete(null);
      setAthleteSubView(null);
      toast.success("Athlete removed successfully.");
      fetchInitialData();
    } catch (e) {
      console.error("Failed to remove athlete:", e);
      toast.error(e.message || "Failed to remove athlete");
    }
  };

  const loadAthleteStats = async (athlete) => {
    setSelectedAthlete(athlete);
    setAthleteSubView("stats");
    setLoadingStats(true);
    try {
      const stats = await api.getAthleteStats(athlete.athlete_id);
      setAthleteStats(stats);
    } catch (e) {
      console.error("Failed to load athlete stats", e);
      toast.error("Could not load athlete statistics");
      setAthleteStats(null);
    } finally {
      setLoadingStats(false);
    }
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
      toast.error("Failed to load workout details");
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
      toast.success("Feedback note added!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add feedback note");
    } finally {
      setSubmittingNote(false);
    }
  };

  // ── Chat logic ──────────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (chattingWith) {
      fetchMessages();
      interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds for new messages
    }
    return () => clearInterval(interval);
  }, [chattingWith]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    if (!chattingWith) return;
    try {
      const chatHistory = await api.getMessages(chattingWith.id);
      setMessages(chatHistory || []);
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chattingWith) return;
    setSendingMessage(true);
    const text = newMessage;
    setNewMessage("");
    try {
      await api.sendMessage(chattingWith.id, text);
      fetchMessages();
    } catch (err) {
      toast.error("Failed to send message");
      setNewMessage(text); // Restore text
    } finally {
      setSendingMessage(false);
    }
  };

  const handleClearChat = async () => {
    if (!chattingWith?.id) return;
    if (!window.confirm("Are you sure you want to clear this conversation? This will delete all messages for both you and the other user. This action cannot be undone.")) {
      return;
    }
    try {
      await api.clearConversation(chattingWith.id);
      setMessages([]);
      toast.success("Conversation cleared");
    } catch (e) {
      console.error("Failed to clear conversation", e);
      toast.error("Failed to clear conversation");
    }
  };

  // ── Suggest Workout logic ───────────────────────────────────────
  useEffect(() => {
    if (exerciseSearchQuery.trim().length > 1) {
      setSearchingExercises(true);
      const delayDebounce = setTimeout(async () => {
        try {
          const res = await api.getExercises({ search: exerciseSearchQuery, limit: 10 });
          setSearchedExercises(res.exercises || res || []);
        } catch (e) {
          console.error(e);
        } finally {
          setSearchingExercises(false);
        }
      }, 500);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchedExercises([]);
    }
  }, [exerciseSearchQuery]);

  const addSuggestWorkoutDay = () => {
    setSuggestWorkouts([
      ...suggestWorkouts,
      { name: `Day ${suggestWorkouts.length + 1}`, exercises: [] }
    ]);
    setActiveSuggestDay(suggestWorkouts.length);
  };

  const removeSuggestWorkoutDay = (index) => {
    if (suggestWorkouts.length === 1) return;
    const nextDays = suggestWorkouts.filter((_, i) => i !== index);
    setSuggestWorkouts(nextDays);
    if (activeSuggestDay >= index && activeSuggestDay > 0) {
      setActiveSuggestDay(activeSuggestDay - 1);
    }
  };

  const addExerciseToSuggest = (ex) => {
    const nextDays = [...suggestWorkouts];
    nextDays[activeSuggestDay].exercises.push({
      id: ex.id,
      exercise_name: ex.name,
      sets: [{ reps: 10, weight_kg: 0 }]
    });
    setSuggestWorkouts(nextDays);
    setExerciseSearchQuery("");
    setSearchedExercises([]);
    toast.success(`${ex.name} added!`);
  };

  const removeExerciseFromSuggest = (exIndex) => {
    const nextDays = [...suggestWorkouts];
    nextDays[activeSuggestDay].exercises = nextDays[activeSuggestDay].exercises.filter((_, i) => i !== exIndex);
    setSuggestWorkouts(nextDays);
  };

  const addSetToSuggestExercise = (exIndex) => {
    const nextDays = [...suggestWorkouts];
    nextDays[activeSuggestDay].exercises[exIndex].sets.push({ reps: 10, weight_kg: 0 });
    setSuggestWorkouts(nextDays);
  };

  const removeSetFromSuggestExercise = (exIndex, setIndex) => {
    const nextDays = [...suggestWorkouts];
    const sets = nextDays[activeSuggestDay].exercises[exIndex].sets;
    if (sets.length === 1) return;
    nextDays[activeSuggestDay].exercises[exIndex].sets = sets.filter((_, i) => i !== setIndex);
    setSuggestWorkouts(nextDays);
  };

  const updateSuggestSet = (exIndex, setIndex, field, val) => {
    const nextDays = [...suggestWorkouts];
    nextDays[activeSuggestDay].exercises[exIndex].sets[setIndex][field] = parseFloat(val) || 0;
    setSuggestWorkouts(nextDays);
  };

  const submitSuggestedProgram = async () => {
    if (!programName.trim()) {
      toast.error("Please enter a Program Name");
      return;
    }
    const isValid = suggestWorkouts.every(w => w.name.trim() && w.exercises.length > 0);
    if (!isValid) {
      toast.error("Every workout day needs a name and at least one exercise.");
      return;
    }

    setSuggestLoading(true);
    try {
      await api.suggestWorkout(selectedAthlete.athlete_id, {
        program_name: programName,
        program_note: programNote,
        workouts: suggestWorkouts
      });
      toast.success(`Program suggested to ${selectedAthlete.name}!`);
      // Reset suggest states
      setProgramName("");
      setProgramNote("");
      setSuggestWorkouts([{ name: "Day 1", exercises: [] }]);
      setActiveSuggestDay(0);
      setAthleteSubView("stats");
    } catch (err) {
      toast.error(err.message || "Failed to suggest program");
    } finally {
      setSuggestLoading(false);
    }
  };

  // ── Render Helpers ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="loader" style={{ width: 40, height: 40, border: "4px solid rgba(255,255,255,0.1)", borderTop: "4px solid var(--aura-cyan)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  // Live Chat Sub-view (re-used for both Coach-Athlete and Athlete-Coach)
  if (chattingWith) {
    return (
      <div className="mobile-page" style={{ paddingBottom: 0, height: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button
            onClick={() => setChattingWith(null)}
            style={{ background: "none", border: "none", color: "var(--color-text)", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}
          >
            <ArrowLeft size={22} />
          </button>

          <div style={{
            width: 36, height: 36, borderRadius: 12, background: "var(--color-surface-h)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "var(--aura-cyan)", overflow: "hidden"
          }}>
            {chattingWith.avatar ? (
              <img src={resolveBackendUrl(chattingWith.avatar)} alt={chattingWith.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              (chattingWith.name || 'C').charAt(0).toUpperCase()
            )}
          </div>

          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>{chattingWith.name || 'Chat'}</h2>
            <span style={{ fontSize: 11, color: "var(--aura-cyan)", fontWeight: 700 }}>Direct Chat</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <button
              onClick={() => setReportingCoach(chattingWith)}
              style={{
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171", borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", padding: "6px 8px"
              }}
              title="Report Coach to Admin"
            >
              <Flag size={16} />
            </button>
            <button
              onClick={handleClearChat}
              style={{
                background: "none", border: "none", color: "var(--color-text)",
                cursor: "pointer", display: "flex", alignItems: "center", padding: 8
              }}
              title="Clear Conversation"
            >
              <Trash2 size={20} style={{ opacity: 0.7 }} />
            </button>
          </div>
        </div>

        {/* Messages list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: 13, fontStyle: "italic", margin: "auto" }}>
              No messages yet. Send a note to start the conversation!
            </div>
          ) : (
            messages.map((m, i) => {
              const isMe = m.sender_id === api.token?.userId() || m.sender_id === undefined; // fallback
              return (
                <div
                  key={i}
                  style={{
                    alignSelf: isMe ? "flex-end" : "flex-start",
                    maxWidth: "75%",
                    background: isMe ? "var(--aura-cyan)" : "rgba(255,255,255,0.06)",
                    color: isMe ? "#000" : "#fff",
                    padding: "10px 14px",
                    borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    fontSize: 13,
                    lineHeight: 1.4,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                  }}
                >
                  <div>{m.message}</div>
                  <div style={{
                    fontSize: 9,
                    color: isMe ? "rgba(0,0,0,0.4)" : "var(--text-secondary)",
                    textAlign: "right",
                    marginTop: 4,
                    fontWeight: 700
                  }}>
                    {new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 0 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "var(--color-bg)",
            flexShrink: 0
          }}
        >
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            style={{
              flex: 1,
              background: "var(--color-surface-h)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: "12px 16px",
              color: "var(--color-text)",
              fontSize: 14,
              outline: "none"
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sendingMessage}
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--aura-cyan)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--color-bg)"
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    );
  }

  // Sub-view: Detailed Workout Session Card
  if (selectedWorkoutDetail) {
    return (
      <div className="mobile-page" style={{ paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", marginBottom: 16 }}>
          <button
            onClick={() => setSelectedWorkoutDetail(null)}
            style={{ background: "var(--color-surface)", border: "none", color: "var(--color-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10 }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>{selectedWorkoutDetail.workout_name}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>{new Date(selectedWorkoutDetail.session_date).toLocaleDateString()} • {Math.round(selectedWorkoutDetail.duration_sec / 60)} min</p>
          </div>
        </div>

        {/* Workout Info Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div className="mobile-card" style={{ padding: 12, textAlign: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>Total Volume</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--aura-cyan)", marginTop: 4 }}>{selectedWorkoutDetail.total_volume} kg</div>
          </div>
          <div className="mobile-card" style={{ padding: 12, textAlign: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>Total Sets</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--aura-cyan)", marginTop: 4 }}>{selectedWorkoutDetail.total_sets} sets</div>
          </div>
        </div>

        {/* Notes (if client left any) */}
        {selectedWorkoutDetail.notes && (
          <div className="mobile-card" style={{ padding: 14, marginBottom: 20 }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>Client Notes</span>
            <p style={{ fontSize: 13, color: "var(--color-text)", margin: "6px 0 0", lineHeight: 1.4 }}>{selectedWorkoutDetail.notes}</p>
          </div>
        )}

        {/* Exercises list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>Exercises</h3>

          {selectedWorkoutDetail.sets && selectedWorkoutDetail.sets.length === 0 ? (
            <div style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center", padding: 20 }}>No exercises recorded.</div>
          ) : (
            // Group sets by exercise_name
            Object.entries(selectedWorkoutDetail.sets.reduce((groups, s) => {
              const name = s.exercise_name || "Unknown";
              if (!groups[name]) groups[name] = [];
              groups[name].push(s);
              return groups;
            }, {})).map(([name, exSets]) => (
              <div key={name} className="mobile-card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: "var(--color-text)" }}>{name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {exSets.map((s, idx) => (
                    <div key={s.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: 4 }}>
                      <span>Set {idx + 1} ({s.set_type || "normal"})</span>
                      <span style={{ fontWeight: 700, color: "var(--color-text)" }}>
                        {s.weight_kg} kg × {s.reps} reps {s.rpe ? `(RPE ${s.rpe})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Coach Feedback Notes */}
        <div className="mobile-card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--aura-cyan)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <MessageSquare size={14} /> Coach Feedback
          </h3>

          {/* List existing feedback */}
          {sessionNotes.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", margin: "0 0 16px" }}>No feedback left on this session yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {sessionNotes.map(n => (
                <div key={n.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 4 }}>
                    <span>{n.coach_name || "Coach"}</span>
                    <span>{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text)", margin: 0, lineHeight: 1.4 }}>{n.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Form to leave feedback (only if coach) */}
          {role === 'coach' && (
            <form onSubmit={handleAddSessionNote} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                placeholder="Leave feedback or recommendations for this session..."
                value={newSessionNote}
                onChange={e => setNewSessionNote(e.target.value)}
                style={{ width: "100%", background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, color: "var(--color-text)", fontSize: 13, minHeight: 60, resize: "none" }}
                required
              />
              <button
                type="submit"
                disabled={submittingNote || !newSessionNote.trim()}
                style={{ alignSelf: "flex-end", background: "var(--aura-cyan)", color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
              >
                {submittingNote ? "Submitting..." : "Add Feedback"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Detailed Athlete Profile view for coaches
  if (selectedAthlete) {
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
      <div className="mobile-page" style={{ paddingBottom: 100 }}>
        {/* Header Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setSelectedAthlete(null)}
              style={{ background: "var(--color-surface)", border: "none", color: "var(--color-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10 }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>{selectedAthlete.name}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>Athlete profile & analytics</p>
            </div>
          </div>
          <button
            onClick={() => handleKickAthlete(selectedAthlete.relationship_id, selectedAthlete.name)}
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#EF4444",
              border: "1px solid rgba(239, 68, 68, 0.15)",
              padding: "8px 14px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <X size={12} /> Kick
          </button>
        </div>

        {/* Mini Tab selector */}
        <div style={{ display: "flex", gap: 6, background: "var(--color-surface)", padding: 4, borderRadius: 12, marginBottom: 20 }}>
          {["stats", "chat", "suggest"].map(sub => (
            <button
              key={sub}
              onClick={() => {
                if (sub === "chat") {
                  setChattingWith({
                    id: selectedAthlete.athlete_id,
                    name: selectedAthlete.name,
                    avatar: selectedAthlete.avatar_url
                  });
                } else {
                  setAthleteSubView(sub);
                }
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 9,
                border: "none",
                background: athleteSubView === sub ? "var(--aura-cyan)" : "transparent",
                color: athleteSubView === sub ? "#000" : "var(--text-secondary)",
                fontWeight: 700,
                fontSize: 12,
                textTransform: "capitalize",
                transition: "all 0.2s"
              }}
            >
              {sub === "suggest" ? "Suggest" : sub}
            </button>
          ))}
        </div>

        {/* Sub-view: Workout Suggestion */}
        {athleteSubView === "suggest" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="mobile-card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 16px", color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Suggest Training Program
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 6 }}>PROGRAM NAME</label>
                  <input
                    type="text"
                    placeholder="e.g. Muscle Gain Push-Pull"
                    value={programName}
                    onChange={e => setProgramName(e.target.value)}
                    style={{ width: "100%", background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, color: "var(--color-text)", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 6 }}>PROGRAM NOTE / ADVICE</label>
                  <textarea
                    placeholder="Provide recommendations, load parameters, rest times..."
                    value={programNote}
                    onChange={e => setProgramNote(e.target.value)}
                    style={{ width: "100%", background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, color: "var(--color-text)", fontSize: 13, minHeight: 60, resize: "none" }}
                  />
                </div>
              </div>
            </div>

            {/* Workout Days Selector Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>Workout Days</span>
              <button
                onClick={addSuggestWorkoutDay}
                style={{ background: "rgba(var(--aura-cyan-rgb), 0.1)", border: "none", color: "var(--aura-cyan)", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
              >
                <Plus size={12} /> Add Day
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {suggestWorkouts.map((w, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSuggestDay(idx)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: activeSuggestDay === idx ? "rgba(var(--aura-cyan-rgb), 0.15)" : "rgba(255,255,255,0.03)",
                    border: activeSuggestDay === idx ? "1px solid var(--aura-cyan)" : "1px solid transparent",
                    color: activeSuggestDay === idx ? "var(--aura-cyan)" : "var(--text-secondary)",
                    fontWeight: 700,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap"
                  }}
                >
                  {w.name}
                  {suggestWorkouts.length > 1 && (
                    <span
                      onClick={(e) => { e.stopPropagation(); removeSuggestWorkoutDay(idx); }}
                      style={{ color: "#EF4444", fontSize: 14, padding: "0 2px" }}
                    >
                      ×
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Exercises inside Day */}
            <div className="mobile-card" style={{ padding: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 6 }}>DAY NAME</label>
                <input
                  type="text"
                  value={suggestWorkouts[activeSuggestDay].name}
                  onChange={e => {
                    const nextDays = [...suggestWorkouts];
                    nextDays[activeSuggestDay].name = e.target.value;
                    setSuggestWorkouts(nextDays);
                  }}
                  placeholder="e.g. Lower Body"
                  style={{ width: "100%", background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 10, color: "var(--color-text)", fontSize: 14 }}
                />
              </div>

              {/* Add Exercise Search Input */}
              <div style={{ marginBottom: 16, position: "relative" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 6 }}>ADD EXERCISE</label>
                <div style={{ display: "flex", alignItems: "center", background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "0 10px" }}>
                  <Search size={14} color="var(--text-secondary)" style={{ marginRight: 8 }} />
                  <input
                    type="text"
                    placeholder="Search exercise..."
                    value={exerciseSearchQuery}
                    onChange={e => setExerciseSearchQuery(e.target.value)}
                    style={{ flex: 1, border: "none", background: "none", color: "var(--color-text)", height: 38, fontSize: 13, outline: "none" }}
                  />
                </div>

                {searchedExercises.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                    background: "rgba(20,22,26,0.98)", border: "1px solid var(--color-border)", borderRadius: 10,
                    maxHeight: 180, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
                  }}>
                    {searchedExercises.map(ex => (
                      <div
                        key={ex.id}
                        onClick={() => addExerciseToSuggest(ex)}
                        style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "var(--color-text)", cursor: "pointer" }}
                      >
                        {ex.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Exercises List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {suggestWorkouts[activeSuggestDay].exercises.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 24, border: "1.5px dashed rgba(255,255,255,0.05)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 12 }}>
                    No exercises added to this day yet. Use search above to add!
                  </div>
                ) : (
                  suggestWorkouts[activeSuggestDay].exercises.map((ex, exIdx) => (
                    <div key={exIdx} style={{ background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>{ex.exercise_name}</span>
                        <button
                          onClick={() => removeExerciseFromSuggest(exIdx)}
                          style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {ex.sets.map((set, setIdx) => (
                          <div key={setIdx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", width: 20 }}>S{setIdx + 1}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-secondary)" }}>REPS</span>
                              <input
                                type="number"
                                value={set.reps}
                                onChange={e => updateSuggestSet(exIdx, setIdx, "reps", e.target.value)}
                                style={{ width: 44, background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "2px 4px", color: "var(--color-text)", fontSize: 11, textAlign: "center" }}
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-secondary)" }}>KG</span>
                              <input
                                type="number"
                                value={set.weight_kg}
                                onChange={e => updateSuggestSet(exIdx, setIdx, "weight_kg", e.target.value)}
                                style={{ width: 50, background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "2px 4px", color: "var(--color-text)", fontSize: 11, textAlign: "center" }}
                              />
                            </div>
                            {ex.sets.length > 1 && (
                              <button
                                onClick={() => removeSetFromSuggestExercise(exIdx, setIdx)}
                                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11 }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => addSetToSuggestExercise(exIdx)}
                        style={{ background: "none", border: "none", color: "var(--aura-cyan)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 2, marginTop: 8 }}
                      >
                        <Plus size={10} /> Add Set
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={submitSuggestedProgram}
              disabled={suggestLoading || !programName.trim()}
              style={{
                width: "100%", background: "var(--aura-cyan)", color: "var(--color-bg)", border: "none", borderRadius: 12, padding: 15, fontWeight: 800, fontSize: 14, cursor: "pointer"
              }}
            >
              {suggestLoading ? "Suggesting Program..." : "Send Program to Athlete"}
            </button>
          </div>
        )}

        {/* Sub-view: Stats Dashboard */}
        {athleteSubView === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Athlete Bio Card */}
            <div className="mobile-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: "var(--color-surface-h)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 800, color: "var(--aura-cyan)", overflow: "hidden"
              }}>
                {selectedAthlete.avatar_url ? (
                  <img src={resolveBackendUrl(selectedAthlete.avatar_url)} alt={selectedAthlete.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  (selectedAthlete.name || selectedAthlete.email || 'A').charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>{selectedAthlete.name || selectedAthlete.email.split('@')[0]}</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: "2px 0 0" }}>{selectedAthlete.email}</p>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: "var(--color-surface-h)", color: "var(--color-text)", padding: "2px 6px", borderRadius: 6 }}>
                    {selectedAthlete.experience?.toUpperCase()}
                  </span>
                  {selectedAthlete.bodyweight > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: "var(--color-surface-h)", color: "var(--color-text)", padding: "2px 6px", borderRadius: 6 }}>
                      {selectedAthlete.bodyweight} KG
                    </span>
                  )}
                </div>
              </div>
            </div>

            {loadingStats ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>Loading stats...</div>
            ) : athleteStats ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Stats Panel */}
                <div className="mobile-card" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity size={14} /> Training Summary
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Sessions</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{athleteStats.workout_summary?.total_sessions || 0}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Volume</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{fmt.tonnes(athleteStats.set_summary?.total_volume || 0)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Avg Session Duration</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{Math.round((athleteStats.workout_summary?.avg_duration_sec || 0) / 60)} min</span>
                    </div>
                  </div>
                </div>

                {/* Nutrition Card */}
                <div className="mobile-card" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Heart size={14} /> Nutrition & Macro Compliance
                  </h4>

                  {nutritionTarget ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Goal: <span style={{ color: "#fff", fontWeight: 700 }}>{nutritionTarget.goal}</span> ({nutritionTarget.pace} pace, {nutritionTarget.diet_style})
                      </div>

                      {/* Calories */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span>Calories (7-day avg)</span>
                          <span style={{ fontWeight: 700 }}>{avgCal} / {Math.round(nutritionTarget.final_calories)} kcal</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min((avgCal / nutritionTarget.final_calories) * 100, 100)}%`, background: "var(--aura-cyan)", borderRadius: 3 }} />
                        </div>
                      </div>

                      {/* Protein */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span>Protein</span>
                          <span style={{ fontWeight: 700 }}>{avgProt}g / {Math.round(nutritionTarget.final_protein)}g</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min((avgProt / nutritionTarget.final_protein) * 100, 100)}%`, background: "#f59e0b", borderRadius: 3 }} />
                        </div>
                      </div>

                      {/* Carbs */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span>Carbs</span>
                          <span style={{ fontWeight: 700 }}>{avgCarb}g / {Math.round(nutritionTarget.final_carbs)}g</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min((avgCarb / nutritionTarget.final_carbs) * 100, 100)}%`, background: "#3b82f6", borderRadius: 3 }} />
                        </div>
                      </div>

                      {/* Fats */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span>Fats</span>
                          <span style={{ fontWeight: 700 }}>{avgFat}g / {Math.round(nutritionTarget.final_fat)}g</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min((avgFat / nutritionTarget.final_fat) * 100, 100)}%`, background: "#ef4444", borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No nutrition target macros configured.</div>
                  )}

                  {athleteStats.recent_nutrition?.length > 0 && (
                    <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase" }}>Recent Logged Days</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {athleteStats.recent_nutrition.slice(0, 3).map(n => (
                          <div key={n.date} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                            <span>{new Date(n.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            <span style={{ color: "var(--color-text)", fontWeight: 700 }}>{n.calories} kcal (P: {Math.round(n.protein)}g C: {Math.round(n.carbs)}g F: {Math.round(n.fat)}g)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sleep Quality & Recovery */}
                <div className="mobile-card" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity size={14} /> Sleep & Recovery
                  </h4>

                  {avgSleep ? (
                    <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
                      <div>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Avg Duration</span>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)" }}>{avgSleep} hrs</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Avg Quality</span>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)" }}>{avgQuality} / 5 ★</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>No sleep reports submitted recently.</div>
                  )}

                  {athleteStats.recent_sleep?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase" }}>Recent Sleep Logs</div>
                      {athleteStats.recent_sleep.slice(0, 3).map(s => (
                        <div key={s.date} style={{ fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 700 }}>{new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            <span style={{ color: "var(--aura-cyan)" }}>{s.hours} hrs ({s.quality}/5 ★)</span>
                          </div>
                          {s.notes && <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2, fontStyle: "italic" }}>"{s.notes}"</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bodyweight History */}
                <div className="mobile-card" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUpIcon size={14} /> Weight Logs & Progress
                  </h4>

                  {athleteStats.recent_weights?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {athleteStats.recent_weights.slice(0, 5).map(w => (
                        <div key={w.logged_at} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: 4 }}>
                          <span>{new Date(w.logged_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span style={{ fontWeight: 800, color: "var(--color-text)" }}>{w.weight_kg} kg</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No weight entries recorded.</div>
                  )}
                </div>

                {/* Personal Records */}
                <div className="mobile-card" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Award size={14} /> Best Lift Estimates (PRs)
                  </h4>

                  {athleteStats.personal_records?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {athleteStats.personal_records.slice(0, 5).map((pr, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: 4 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>{pr.exercise_name}</div>
                            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{pr.weight_kg} kg × {pr.reps} reps • {new Date(pr.achieved_date).toLocaleDateString()}</div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--aura-cyan)" }}>
                            {Math.round(pr.one_rm_est)} kg <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-secondary)" }}>1RM</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No personal records established.</div>
                  )}
                </div>

                {/* Wellness Card */}
                <div className="mobile-card" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertCircle size={14} /> Wellness & Fatigue
                  </h4>

                  {athleteStats.latest_fatigue ? (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Fatigue Score</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: athleteStats.latest_fatigue.level === 'high' ? '#EF4444' : 'var(--aura-cyan)' }}>
                        {athleteStats.latest_fatigue.raw_score}% <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>({athleteStats.latest_fatigue.label})</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>No fatigue reports submitted recently.</div>
                  )}

                  {athleteStats.active_injuries?.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#EF4444", marginBottom: 6 }}>ACTIVE INJURIES</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {athleteStats.active_injuries.map((inj, i) => (
                          <div key={i} style={{ fontSize: 12, color: "var(--color-text)" }}>• {inj.body_part} ({inj.severity})</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#22C55E", fontWeight: 700 }}>No active injuries reported.</div>
                  )}
                </div>

                {/* Workouts Card (Clickable Recent Workouts) */}
                <div className="mobile-card" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={14} /> Recent Workouts (Click for Detail)
                  </h4>

                  {athleteStats.recent_workouts?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {athleteStats.recent_workouts.map(w => (
                        <div
                          key={w.id}
                          onClick={() => loadWorkoutDetail(w.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{w.workout_name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{new Date(w.session_date).toLocaleDateString()}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--aura-cyan)" }}>{fmt.int(w.volume)} kg</span>
                            <ChevronRight size={14} color="var(--text-secondary)" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No logged workouts found.</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)", fontSize: 13 }}>No stats available for this athlete.</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Split coaches into Active/Pending vs available for directory
  const activeOrPending = coaches.filter(c => c.status === 'active' || c.status === 'pending');
  const browseCoaches = coaches.filter(c => !c.status || c.status === 'declined');

  // ── Main Page Layout ────────────────────────────────────────────
  if (role === 'coach' && !(profile?.verification_status === "approved" || (!profile?.verification_status && (profile?.approved || profile?.coach_verified)))) {
    return (
      <div className="mobile-page" style={{ paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ padding: "16px 0", marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: "var(--color-text)", letterSpacing: "-0.02em" }}>Coaching Zone</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>Onboarding & credentials verification.</p>
        </div>
        {renderCoachOnboarding()}
      </div>
    );
  }

  return (
    <div className="mobile-page" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "16px 0", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: "var(--color-text)", letterSpacing: "-0.02em" }}>Coaching Zone</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>Roster management, training suggestions, and client interactions.</p>
      </div>

      {role === 'coach' ? (
        <RequireCoachRole>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <MobileCoachWorkspaceNav />

            {location.pathname.startsWith("/coach/schedule") ? (
              <ScheduleSection />
            ) : location.pathname.startsWith("/coach/ai-reports") ? (
              <AiReportsSection />
            ) : location.pathname.startsWith("/coach/events") ? (
              <EventsSection />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Invite Section */}
                <div className="mobile-card" style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 800, color: "var(--aura-cyan)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <UserPlus size={14} /> Invite Athlete
                  </h3>
                  <form onSubmit={handleInvite} style={{ display: "flex", gap: 10 }}>
                    <input
                      type="text"
                      placeholder="Athlete's email or nickname"
                      value={inviteIdentifier}
                      onChange={e => setInviteIdentifier(e.target.value)}
                      style={{
                        flex: 1, background: "var(--color-surface-h)", border: "1px solid var(--color-border)",
                        borderRadius: 10, padding: "10px 14px", color: "var(--color-text)", fontSize: 13, outline: "none"
                      }}
                      required
                    />
                    <button
                      type="submit"
                      disabled={inviteLoading}
                      style={{
                        background: "var(--aura-cyan)", color: "var(--color-bg)", border: "none",
                        borderRadius: 10, padding: "0 16px", fontWeight: 800, fontSize: 13, cursor: "pointer"
                      }}
                    >
                      {inviteLoading ? "..." : "Invite"}
                    </button>
                  </form>
                </div>

                {/* Athletes List */}
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={16} color="var(--text-secondary)" /> Active Athletes ({athletes.length})
                  </h3>

                  {athletes.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, border: "1.5px dashed rgba(255,255,255,0.05)", borderRadius: 16, color: "var(--text-secondary)" }}>
                      <Users size={32} style={{ opacity: 0.2, marginBottom: 8, margin: "0 auto" }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>No Athletes Assigned</div>
                      <p style={{ fontSize: 12, margin: "4px 0 0" }}>Invite an athlete above to start coaching.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {athletes.map(a => (
                        <div
                          key={a.relationship_id}
                          onClick={() => a.status === 'active' && loadAthleteStats(a)}
                          className="mobile-card"
                          style={{
                            padding: 14,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            cursor: a.status === 'active' ? "pointer" : "default"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 10, background: "var(--color-surface-h)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 14, fontWeight: 800, color: "var(--color-text)", overflow: "hidden"
                            }}>
                              {a.avatar_url ? (
                                <img src={resolveBackendUrl(a.avatar_url)} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                (a.name || a.email || 'A').charAt(0).toUpperCase()
                              )}
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>{a.name || a.email.split('@')[0]}</div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.email}</div>
                            </div>

                            {a.status === 'active' && <ChevronRight size={18} color="var(--text-secondary)" />}
                          </div>

                          {a.status === 'pending' ? (
                            a.initiated_by === 'athlete' ? (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleResponse(a.relationship_id, 'accept'); }}
                                  style={{ flex: 1, background: "var(--aura-cyan)", color: "#000", border: "none", borderRadius: 8, padding: "6px 0", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
                                >
                                  <Check size={12} /> Accept Request
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleResponse(a.relationship_id, 'decline'); }}
                                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 0", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
                                >
                                  <X size={12} /> Decline
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.08)", color: "#f59e0b", padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                                <AlertCircle size={12} /> Invitation Pending (Waiting for Athlete)
                              </div>
                            )
                          ) : (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10, fontSize: 11 }}>
                              <div style={{ display: "flex", gap: 16 }}>
                                <div>
                                  <span style={{ color: "var(--text-secondary)", fontWeight: 700, marginRight: 4 }}>Sessions:</span>
                                  <span style={{ color: "var(--color-text)", fontWeight: 800 }}>{a.total_sessions}</span>
                                </div>
                                <div>
                                  <span style={{ color: "var(--text-secondary)", fontWeight: 700, marginRight: 4 }}>Last Active:</span>
                                  <span style={{ color: "var(--color-text)", fontWeight: 800 }}>
                                    {a.last_session ? new Date(a.last_session).toLocaleDateString([], { day: 'numeric', month: 'short' }) : "Never"}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleKickAthlete(a.relationship_id, a.name);
                                }}
                                style={{
                                  background: "rgba(239, 68, 68, 0.1)",
                                  color: "#EF4444",
                                  border: "none",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "10px",
                                  fontWeight: "800",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2
                                }}
                              >
                                <X size={10} /> Kick
                              </button>
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
        </RequireCoachRole>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Athlete Zone Navigation Bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px",
            margin: "0 0 12px 0",
            background: "var(--bg-glass, rgba(15, 23, 42, 0.85))",
            border: "1px solid var(--border-card, rgba(255, 255, 255, 0.08))",
            borderRadius: "14px",
            backdropFilter: "blur(14px)",
          }}>
            <button
              type="button"
              onClick={() => navigate('/coach')}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: (!location.pathname.startsWith('/coach/events') && !location.pathname.startsWith('/events')) ? 800 : 600,
                color: (!location.pathname.startsWith('/coach/events') && !location.pathname.startsWith('/events')) ? "#fff" : "var(--color-text-2, rgba(255,255,255,0.6))",
                background: (!location.pathname.startsWith('/coach/events') && !location.pathname.startsWith('/events'))
                  ? "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)"
                  : "transparent",
                border: (!location.pathname.startsWith('/coach/events') && !location.pathname.startsWith('/events'))
                  ? "1px solid rgba(6, 182, 212, 0.5)"
                  : "1px solid transparent",
                boxShadow: (!location.pathname.startsWith('/coach/events') && !location.pathname.startsWith('/events'))
                  ? "0 0 12px rgba(6, 182, 212, 0.25)"
                  : "none",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <Users size={15} style={{ color: (!location.pathname.startsWith('/coach/events') && !location.pathname.startsWith('/events')) ? "var(--aura-cyan)" : "inherit" }} />
              <span>Find & My Coach</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/coach/events')}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: (location.pathname.startsWith('/coach/events') || location.pathname.startsWith('/events')) ? 800 : 600,
                color: (location.pathname.startsWith('/coach/events') || location.pathname.startsWith('/events')) ? "#fff" : "var(--color-text-2, rgba(255,255,255,0.6))",
                background: (location.pathname.startsWith('/coach/events') || location.pathname.startsWith('/events'))
                  ? "linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)"
                  : "transparent",
                border: (location.pathname.startsWith('/coach/events') || location.pathname.startsWith('/events'))
                  ? "1px solid rgba(139, 92, 246, 0.5)"
                  : "1px solid transparent",
                boxShadow: (location.pathname.startsWith('/coach/events') || location.pathname.startsWith('/events'))
                  ? "0 0 12px rgba(139, 92, 246, 0.25)"
                  : "none",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <Trophy size={15} style={{ color: (location.pathname.startsWith('/coach/events') || location.pathname.startsWith('/events')) ? "var(--aura-accent)" : "inherit" }} />
              <span>Events</span>
              <span style={{
                fontSize: 8,
                fontWeight: 900,
                padding: "1px 5px",
                borderRadius: 4,
                background: "var(--aura-accent, #8b5cf6)",
                color: "#fff",
                lineHeight: 1,
              }}>
                LIVE
              </span>
            </button>
          </div>

          {location.pathname.startsWith("/coach/events") || location.pathname.startsWith("/events") ? (
            <EventsSection />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Active / Pending Coach Relationships */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={16} color="var(--text-secondary)" /> Your Assigned Coach
                </h3>

                {activeOrPending.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, border: "1.5px dashed rgba(255,255,255,0.05)", borderRadius: 16, color: "var(--text-secondary)", marginBottom: 12 }}>
                    <Users size={32} style={{ opacity: 0.2, marginBottom: 8, margin: "0 auto" }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>No Coach Linked</div>
                    <p style={{ fontSize: 12, margin: "4px 0 0" }}>Browse the list below to hire a coach.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                    {activeOrPending.map(c => (
                      <div key={c.relationship_id} className="mobile-card" style={{ padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 12, background: "var(--color-surface-h)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, fontWeight: 800, color: "var(--aura-cyan)", overflow: "hidden"
                          }}>
                            {c.coach_avatar ? (
                              <img src={resolveBackendUrl(c.coach_avatar)} alt={c.coach_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              (c.coach_name || c.coach_email || 'C').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--color-text)" }}>{c.coach_name || c.coach_email.split('@')[0]}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.coach_email}</div>
                          </div>
                        </div>

                        {c.status === 'pending' ? (
                          c.initiated_by === 'coach' ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => handleResponse(c.relationship_id, 'accept')}
                                style={{ flex: 1, background: "var(--aura-cyan)", color: "var(--color-bg)", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
                              >
                                <Check size={14} /> Accept Invite
                              </button>
                              <button
                                onClick={() => handleResponse(c.relationship_id, 'decline')}
                                style={{ flex: 1, background: "var(--color-surface-h)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 0", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
                              >
                                <X size={14} /> Decline
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.08)", color: "#f59e0b", padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                              <AlertCircle size={14} /> Request Pending (Waiting for Coach Approval)
                            </div>
                          )
                        ) : (
                          <div style={{ display: "flex", gap: 8, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 12 }}>
                            <button
                              onClick={() => setChattingWith({
                                id: c.coach_id,
                                name: c.coach_name,
                                avatar: c.coach_avatar
                              })}
                              style={{ flex: 1, background: "var(--aura-cyan)", color: "var(--color-bg)", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}
                            >
                              <MessageSquare size={14} /> Chat
                            </button>
                            <button
                              onClick={() => setReportingCoach({
                                coach_id: c.coach_id,
                                coach_name: c.coach_name
                              })}
                              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: 10, padding: "10px 14px", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
                              title="Report this coach to admin"
                            >
                              <Flag size={13} /> Report
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Gym Map Explorer */}
              <div className="mobile-card" style={{ padding: 18, marginBottom: 16, border: "1px solid var(--color-border)", borderRadius: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin size={18} color="var(--aura-cyan)" style={{ filter: "drop-shadow(0 0 3px var(--aura-cyan))" }} /> Gym Map Explorer
                </h3>

                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.4 }}>
                  Select your region or drag the marker to find nearest gyms and their active coaches.
                </p>

                {/* Region Selector */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
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
                          background: isSelected ? "var(--aura-cyan)" : "var(--color-surface-h)",
                          color: isSelected ? "#000" : "var(--color-text)",
                          border: isSelected ? "1px solid var(--aura-cyan)" : "1px solid var(--color-border)",
                          padding: "6px 14px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {reg.name}
                      </button>
                    );
                  })}
                </div>

                {/* Dedicated Mobile Leaflet Map */}
                <MobileGymMap
                  gyms={gyms}
                  userLoc={userLoc}
                  setUserLoc={setUserLoc}
                  selectedRegion={selectedRegion}
                  onSelectGym={(g) => setUserLoc({ lat: g.latitude, lng: g.longitude })}
                />

                {/* Nearest Gyms & Coaches List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 900, margin: "0 0 4px", color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    GYMS NEAR YOU
                  </h4>

                  {nearestGyms.slice(0, 4).map(g => (
                    <div key={g.id} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>{g.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{g.address}</div>
                        </div>
                        <span className="glass-pill" style={{ fontSize: 9, padding: "2px 8px", background: "var(--color-surface-h)", color: "var(--aura-cyan)", fontWeight: 800 }}>
                          {g.distance.toFixed(1)} km
                        </span>
                      </div>

                      {g.coaches && g.coaches.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
                          {g.coaches.map(c => {
                            const match = coaches.find(curr => curr.coach_id === c.coach_id);
                            const isHired = match?.status === 'active';
                            const isPending = match?.status === 'pending';

                            return (
                              <div key={c.coach_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-surface-h)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--aura-cyan)", overflow: "hidden", border: "1px solid var(--color-border)", flexShrink: 0 }}>
                                    {c.avatar_url ? (
                                      <img src={resolveBackendUrl(c.avatar_url)} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      (c.name || c.email || 'C').charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || c.email.split('@')[0]}</div>
                                    <div style={{ fontSize: 9, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {(EXP_LABELS[c.experience?.toLowerCase()] || c.experience || 'TRAINER').toUpperCase()} • {(GOAL_LABELS[c.goal?.toLowerCase()] || c.goal || 'FITNESS').toUpperCase()}
                                    </div>
                                  </div>
                                </div>

                                {isHired ? (
                                  <div style={{ background: "rgba(34, 197, 94, 0.08)", color: "#22c55e", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, flexShrink: 0 }}>
                                    Active
                                  </div>
                                ) : isPending ? (
                                  <div style={{ background: "rgba(245, 158, 11, 0.08)", color: "#f59e0b", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, flexShrink: 0 }}>
                                    Pending
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleHireCoach(c.coach_id)}
                                    className="btn-primary"
                                    style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, flexShrink: 0, width: "auto" }}
                                  >
                                    Hire
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: "var(--text-secondary)", fontStyle: "italic", marginTop: 8 }}>
                          No resident coaches registered here.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Directory of Coaches */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Search size={16} color="var(--text-secondary)" /> Browse & Hire Coaches
                </h3>

                {browseCoaches.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 24, border: "1.5px dashed rgba(255,255,255,0.05)", borderRadius: 16, color: "var(--text-secondary)" }}>
                    No other coaches available.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {browseCoaches.map(c => {
                      const cRating = Number(c.rating || 4.8).toFixed(1);
                      const cReviews = c.review_count || 12;
                      const cAthletes = c.athletes_count || 18;
                      return (
                        <div
                          key={c.coach_id}
                          className="mobile-card"
                          onClick={() => setSelectedCoachForInfo(c)}
                          style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 12, background: "var(--color-surface-h)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 14, fontWeight: 800, color: "var(--aura-cyan)", overflow: "hidden",
                              border: "1.5px solid rgba(6, 182, 212, 0.4)", flexShrink: 0
                            }}>
                              {c.coach_avatar ? (
                                <img src={resolveBackendUrl(c.coach_avatar)} alt={c.coach_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                (c.coach_name || c.coach_email || 'C').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--color-text)" }}>{c.coach_name || c.coach_email.split('@')[0]}</div>

                              {/* Rating and Athletes stats */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>
                                  <Star size={11} fill="#f59e0b" />
                                  <span>{cRating}</span>
                                  <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>({cReviews})</span>
                                </div>

                                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>•</span>

                                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#38bdf8" }}>
                                  <Users size={11} />
                                  <span>{cAthletes}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHireCoach(c.coach_id);
                            }}
                            style={{
                              background: "rgba(var(--aura-cyan-rgb), 0.1)",
                              border: "1px solid var(--aura-cyan)",
                              color: "var(--aura-cyan)",
                              borderRadius: 8,
                              padding: "6px 12px",
                              fontWeight: 800,
                              fontSize: 11,
                              cursor: "pointer"
                            }}
                          >
                            Hire
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedCoachForInfo && (
        <CoachProfileModal
          coach={selectedCoachForInfo}
          onClose={() => setSelectedCoachForInfo(null)}
          onHireCoach={handleHireCoach}
        />
      )}

      {reportingCoach && (
        <ReportCoachModal
          coach={reportingCoach}
          onClose={() => setReportingCoach(null)}
        />
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
