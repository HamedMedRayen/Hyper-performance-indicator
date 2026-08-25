import { getApiBaseUrl, getCandidateApiUrls, setVerifiedWorkingBaseUrl } from './config';
import { getSyncItem, setItem, removeItem } from './storage';

// ── 401 debounce guard ────────────────────────────────────────
// Prevents cascading logouts when multiple concurrent requests
// all receive 401 and try to clear the token simultaneously.
let isLoggingOut = false;
let authSuppressionTimer = null;

// Call after login to temporarily suppress 401 → logout behavior
// while cached token propagates to all concurrent requests.
export function suppressAuthRedirect(ms = 2000) {
  clearTimeout(authSuppressionTimer);
  isLoggingOut = false;
  authSuppressionTimer = setTimeout(() => {
    authSuppressionTimer = null;
  }, ms);
}

// ── Token storage ─────────────────────────────────────────────
export const token = {
  get: () => getSyncItem("aura_token"),
  set: (t) => setItem("aura_token", t),
  clear: () => {
    removeItem("aura_token");
    removeItem("aura_user");
  },
  userId: () => {
    const raw = getSyncItem("aura_user");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed.user_id || parsed.id || null;
    } catch (e) {
      return null;
    }
  },
  user: () => {
    const raw = getSyncItem("aura_user");
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (u) => setItem("aura_user", JSON.stringify(u)),
};

export async function autoDetectServer() {
  const candidates = getCandidateApiUrls();
  for (const candidate of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${candidate}/auth/me`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status === 200 || res.status === 401) {
        setVerifiedWorkingBaseUrl(candidate);
        localStorage.setItem("custom_api_url", candidate);
        return candidate;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ── Core fetch ────────────────────────────────────────────────
async function req(path, opts = {}) {
  const headers = { ...opts.headers };
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const t = token.get();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  let baseUrl = getApiBaseUrl();
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, { ...opts, headers });
    setVerifiedWorkingBaseUrl(baseUrl);
  } catch (err) {
    if (err.name === "TypeError" && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("failed"))) {
      // Auto-fallback: Probe candidates sequentially
      const candidates = getCandidateApiUrls().filter(c => c !== baseUrl);
      let foundWorking = false;
      for (const candidate of candidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const fallbackRes = await fetch(`${candidate}${path}`, { ...opts, headers, signal: controller.signal });
          clearTimeout(timeoutId);
          if (fallbackRes) {
            setVerifiedWorkingBaseUrl(candidate);
            localStorage.setItem("custom_api_url", candidate);
            res = fallbackRes;
            foundWorking = true;
            break;
          }
        } catch (e2) {
          continue;
        }
      }
      if (!foundWorking) {
        throw new Error(`Unable to connect to server at ${baseUrl}. Please check your connection or server IP.`);
      }
    } else {
      throw err;
    }
  }

  // Handle unauthorized errors (except for auth routes themselves)
  if (res.status === 401 && !path.startsWith("/auth/")) {
    // If we just logged in, don't nuke the token — it's a stale/racing request
    if (authSuppressionTimer) {
      console.warn(`[API] Suppressed 401 logout for ${path} (auth suppression active)`);
      throw new Error("Unauthorized");
    }
    // Debounce: only the first 401 triggers logout
    if (!isLoggingOut) {
      isLoggingOut = true;
      token.clear();
      if (window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
      // Reset after a short delay so future real 401s still work
      setTimeout(() => { isLoggingOut = false; }, 2000);
    }
    throw new Error("Unauthorized");
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[API] ${opts.method || 'GET'} ${path} → ${res.status}`, data);
    throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  }
  return data;
}

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  register: (nickname, password, email, role = 'athlete') =>
    req("/auth/register", { method: "POST", body: JSON.stringify({ nickname, password, email, role }) }),
  login: (nickname, password) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ nickname, password }) }),
  googleLogin: (token) =>
    req("/auth/google", { method: "POST", body: JSON.stringify({ token }) }),
  requestOtp: (email) =>
    req("/auth/email-otp-request", { method: "POST", body: JSON.stringify({ email }) }),
  verifyOtp: (email, otp) =>
    req("/auth/email-otp-verify", { method: "POST", body: JSON.stringify({ email, otp }) }),
  me: () => req("/auth/me"),
};

// ── User-aware api helper ─────────────────────────────────────
function uid() {
  const id = token.userId();
  if (!id) throw new Error("Not logged in");
  return id;
}

export const api = {
  // User
  getUser: () => req(`/users/${uid()}`),
  getUserStats: () => req(`/users/${uid()}/stats`),
  updateUser: (data) => req(`/users/me`, { method: "PATCH", body: JSON.stringify(data) }),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return req("/users/me/avatar", { method: "POST", body: fd });
  },

  // Workouts
  getWorkouts: (limit = 50) => req(`/workouts/users/${uid()}?limit=${limit}`),
  getWorkout: (id) => req(`/workouts/${id}`),
  createWorkout: (payload) => req("/workouts/", { method: "POST", body: JSON.stringify({ ...payload, user_id: uid() }) }),
  deleteWorkout: (id) => req(`/workouts/${id}`, { method: "DELETE" }),

  // Exercises & body parts
  getExercises: (filters = {}) => {
    const params = new URLSearchParams();
    if (typeof filters === "string") {
      // Backward compat: getExercises("chest") => body_part=chest
      if (filters) params.set("body_part", filters);
    } else {
      if (filters.body_part) params.set("body_part", filters.body_part);
      if (filters.equipment) params.set("equipment", filters.equipment);
      if (filters.search) params.set("search", filters.search);
      if (filters.muscle) params.set("muscle", filters.muscle);
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.offset) params.set("offset", String(filters.offset));
    }
    const qs = params.toString();
    return req(`/exercises/${qs ? `?${qs}` : ""}`);
  },
  getBodyParts: () => req("/exercises/body-parts"),
  getCategories: () => req("/exercises/categories"),
  searchExercises: (q) => req(`/exercises/?search=${encodeURIComponent(q)}`),
  getExercisesList: () => req("/workouts/exercises"),  // legacy for autocomplete
  createCustomExercise: (payload) => req("/exercises/custom", { method: "POST", body: JSON.stringify(payload) }),

  // PRs, volume, heatmap
  getPRs: () => req(`/workouts/users/${uid()}/prs`),
  getVolume: () => req(`/workouts/users/${uid()}/volume`),
  getExerciseProgress: (name) => req(`/workouts/users/${uid()}/exercise/${encodeURIComponent(name)}`),
  getHeatmap: () => req(`/workouts/users/${uid()}/heatmap`),

  // Analytics
  getDashboard: () => req(`/analytics/users/${uid()}/dashboard`),
  getDashboardAnalytics: (id) => req(`/analytics/users/${id || uid()}/dashboard`),
  getMetrics: (limit = 200) => req(`/metrics/users/${uid()}?limit=${limit}`),

  // AI Recommendations
  getRecommendation: (payload) =>
    req("/ai-recommend/", { method: "POST", body: JSON.stringify(payload) }),

  // Exercise history & PRs (new)
  getLastSet: (name) => req(`/exercises/${encodeURIComponent(name)}/last-set`),
  getExercisePR: (name) => req(`/exercises/${encodeURIComponent(name)}/pr`),
  getExerciseHistory: (name) => req(`/exercises/history/${encodeURIComponent(name)}`),
  lookupExercise: (query) => req(`/exercises/lookup?query=${encodeURIComponent(query)}`),


  // Templates (new)
  getTemplates: () => req(`/workouts/templates`),
  saveTemplate: (payload) => req("/workouts/templates", { method: "POST", body: JSON.stringify(payload) }),
  deleteTemplate: (id) => req(`/workouts/templates/${id}`, { method: "DELETE" }),

  // Body weight (new)
  logBodyWeight: (weight_kg, dateStr) => req("/bodyweight", { method: "POST", body: JSON.stringify({ weight_kg, date: dateStr }) }),
  getBodyWeightLog: (days = 30) => req(`/bodyweight?days=${days}`),

  // Analytics - new endpoints (new)
  getMuscleHeatmap: (days = 7) => req(`/analytics/muscle-heatmap?days=${days}`),
  getMonthlyVolume: () => req(`/analytics/monthly-volume`),

  // Workout Plans (new)
  getPlans: () => req("/recommendations/plans"),
  savePlan: (payload) => req("/recommendations/save", { method: "POST", body: JSON.stringify(payload) }),
  getRecommendationHistory: (user_id) => req(`/recommendations/history/${user_id}`),

  // Progress Dashboard
  getProgressWeightHistory: () => req("/progress/weight-history"),
  getProgressRepsHistory: (exercise_id) => req(`/progress/reps-history?exercise_id=${exercise_id}`),
  getProgressSessionHistory: (exercise_id) => req(`/progress/session-history?exercise_id=${exercise_id}`),
  getProgressWorkoutsPerWeek: () => req("/progress/workouts-per-week"),
  getExerciseTrackerData: (exerciseId, endpoint) => req(`/progress/exercise/${exerciseId}/${endpoint}`),

  // Dashboard Home
  getDashboardStats: () => req("/progress/stats"),
  getVolumeHistory: () => req("/progress/volume-history"),
  getWeeklyVolume: () => req("/progress/weekly-volume"),
  getTrainingSplit: () => req("/progress/training-split"),
  getActivityMap: () => req("/progress/activity-map"),
  getStreak: () => req("/progress/streak"),
  logRestDay: () => req("/progress/rest-day", { method: "POST" }),

  // Fatigue
  logFatigue: (data) => req("/fatigue/log", { method: "POST", body: JSON.stringify(data) }),
  getFatigueHistory: () => req("/fatigue/history"),

  // Injuries & Measurements
  getInjuries: () => req("/injuries"),
  getMeasurementsHistory: () => req("/measurements/history"),
  logInjury: (data) => req("/injuries", { method: "POST", body: JSON.stringify(data) }),
  markInjuryHealed: (id) => req(`/injuries/${id}`, { method: "PATCH" }),
  deleteInjury: (id) => req(`/injuries/${id}`, { method: "DELETE" }),
  // Challenges
  getChallenges: () => req("/challenges"),
  getActiveChallenge: () => req(`/challenges/active/${uid()}`),
  joinChallenge: (challenge_id) => req("/challenges/join", { method: "POST", body: JSON.stringify({ user_id: uid(), challenge_id }) }),
  cancelChallenge: () => req("/challenges/cancel", { method: "POST", body: JSON.stringify({ user_id: uid() }) }),
  checkinChallenge: (day) => req("/challenges/checkin", { method: "POST", body: JSON.stringify({ user_id: uid(), day }) }),

  // Coach
  getCoachRole: () => req("/coach/role"),
  inviteAthlete: (athlete_identifier) => req("/coach/invite", { method: "POST", body: JSON.stringify({ athlete_identifier }) }),
  getMyAthletes: () => req("/coach/athletes"),
  getAthleteStats: (athleteId) => req(`/coach/athletes/${athleteId}/stats`),
  suggestWorkout: (athleteId, data) => req(`/coach/athletes/${athleteId}/suggest-workout`, { method: "POST", body: JSON.stringify(data) }),
  assignNutritionTarget: (athleteId, data) => req(`/coach/athletes/${athleteId}/nutrition-target`, { method: "POST", body: JSON.stringify(data) }),
  submitCheckIn: (athleteId, data) => req(`/coach/athletes/${athleteId}/check-in`, { method: "POST", body: JSON.stringify(data) }),
  getMyCoach: () => req("/coach/my-coach"),
  respondInvite: (relationship_id, action) => req("/coach/respond", { method: "POST", body: JSON.stringify({ relationship_id, action }) }),
  removeRelationship: (relationship_id) => req("/coach/remove", { method: "POST", body: JSON.stringify({ relationship_id }) }),
  getAllCoaches: () => req("/coach/coaches"),
  getCoachProfile: (coachId) => req(`/coach/coaches/${coachId}`),
  addCoachReview: (coachId, rating, comment) => req(`/coach/coaches/${coachId}/reviews`, { method: "POST", body: JSON.stringify({ rating, comment }) }),
  submitCoachOnboarding: (formData) => req("/coach/onboarding", { method: "POST", body: formData }),
  hireCoach: (coachId) => req("/coach/hire", { method: "POST", body: JSON.stringify({ coach_id: coachId }) }),
  getSessionNotes: (sessionId) => req(`/coach/notes/session/${sessionId}`),
  addSessionNote: (athleteId, sessionId, note) => req("/coach/notes", { method: "POST", body: JSON.stringify({ athlete_id: athleteId, session_id: sessionId, note }) }),
  getGyms: () => req("/coach/gyms"),
  selectCoachGyms: (gymIds) => req("/coach/gyms/select", { method: "POST", body: JSON.stringify({ gym_ids: gymIds }) }),

  // Notifications
  getNotifications: () => req("/notifications"),
  getUnreadNotificationsCount: () => req("/notifications/unread-count"),
  markNotificationRead: (id) => req(`/notifications/${id}/read`, { method: "PATCH" }),
  deleteNotification: (id) => req(`/notifications/${id}`, { method: "DELETE" }),

  // Coach Chat
  sendMessage: (receiver_id, message) => req("/coach-chat/send", { method: "POST", body: JSON.stringify({ receiver_id, message }) }),
  getMessages: (other_user_id) => req(`/coach-chat/messages/${other_user_id}`),
  getConversations: () => req("/coach-chat/conversations"),
  clearConversation: (other_user_id) => req(`/coach-chat/clear/${other_user_id}`, { method: "DELETE" }),


  // Nutrition
  searchFood: (q) => req(`/nutrition/food/search?q=${encodeURIComponent(q)}`),
  getAllFood: () => req("/nutrition/food/all"),
  createCustomFood: (payload) => req("/nutrition/food/custom", { method: "POST", body: JSON.stringify(payload) }),
  createRecipe: (payload) => req("/nutrition/recipes", { method: "POST", body: JSON.stringify(payload) }),
  getRecipes: () => req("/nutrition/recipes"),
  getRecipeDetails: (id) => req(`/nutrition/recipes/${id}`),
  logNutrition: (payload) => req("/nutrition/log", { method: "POST", body: JSON.stringify(payload) }),
  quickAddNutrition: (payload) => req("/nutrition/log/quick", { method: "POST", body: JSON.stringify(payload) }),
  deleteNutritionLog: (id) => req(`/nutrition/log/${id}`, { method: "DELETE" }),
  getNutritionToday: (dateStr) => req(dateStr ? `/nutrition/today?date=${dateStr}` : "/nutrition/today"),
  getNutritionHistory: () => req("/nutrition/history"),
  copyMeals: (from_date, to_date) => req("/nutrition/log/copy", { method: "POST", body: JSON.stringify({ from_date, to_date }) }),
  scanMeal: (description, meal_category = "Breakfast", dateStr) => req("/nutrition/scan", { method: "POST", body: JSON.stringify({ description, meal_category, date: dateStr }) }),
  scanMealVision: (image_base64, auto_log = false) => req("/nutrition/scan-vision", { method: "POST", body: JSON.stringify({ image_base64, auto_log }) }),
  logWater: (amount_ml, action = "add") => req("/nutrition/water", { method: "POST", body: JSON.stringify({ amount_ml, action }) }),
  getWaterToday: () => req("/nutrition/water/today"),
  calculateNutritionTargets: (payload) => req("/nutrition/calculate-targets", { method: "POST", body: JSON.stringify(payload) }),
  saveNutritionTargets: (payload) => req("/nutrition/save-targets", { method: "POST", body: JSON.stringify(payload) }),
  getLatestNutritionTargets: () => req("/nutrition/targets/latest"),

  // Coach Schedule / Calendar
  getCoachSchedule: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    return req(`/coach/schedule?${params.toString()}`);
  },
  createScheduleItem: (data) => req("/coach/schedule", { method: "POST", body: JSON.stringify(data) }),
  updateScheduleItem: (itemId, data) => req(`/coach/schedule/${itemId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteScheduleItem: (itemId) => req(`/coach/schedule/${itemId}`, { method: "DELETE" }),
  getMySessions: () => req("/coach/my-sessions"),
  generateAthleteAiReport: (athleteId, payload) => req(`/coach/athlete/${athleteId}/ai-report`, { method: "POST", body: JSON.stringify(payload) }),
  saveOnboarding: (answers) => req("/onboarding/save", { method: "POST", body: JSON.stringify({ answers }) }),
  getCoachVerificationStatus: () => req("/coach/verification-status"),

  // Generic REST methods
  get: (path) => req(path, { method: "GET" }),
  post: (path, body, opts = {}) => {
    const isFormData = body instanceof FormData;
    return req(path, {
      method: "POST",
      body: isFormData ? body : (typeof body === "string" || !body ? body : JSON.stringify(body)),
      ...opts
    });
  },
  delete: (path) => req(path, { method: "DELETE" }),

  // Community Events
  getEvents: (eventType = "all") => req(`/events${eventType && eventType !== "all" ? `?event_type=${eventType}` : ""}`),
  registerEvent: (eventId) => req(`/events/${eventId}/register`, { method: "POST" }),
  unregisterEvent: (eventId) => req(`/events/${eventId}/unregister`, { method: "POST" }),
  createEvent: (payload) => req("/events", { method: "POST", body: JSON.stringify(payload) }),
  deleteEvent: (eventId) => req(`/events/${eventId}`, { method: "DELETE" }),
  uploadEventPoster: (formData) => req("/events/upload-poster", { method: "POST", body: formData }),
};

// ── Admin API Client ──────────────────────────────────────────
export const admin = {
  getStats: () => req("/admin/stats"),
  getVerifications: (status = "pending", page = 1, limit = 20) =>
    req(`/admin/coach-verifications?status=${encodeURIComponent(status)}&page=${page}&limit=${limit}`),
  getVerificationDetail: (id) => req(`/admin/coach-verifications/${id}`),
  getAiReview: (id) => req(`/admin/coach-verifications/${id}/ai-review`, { method: "POST" }),
  approveVerification: (id) => req(`/admin/coach-verifications/${id}/approve`, { method: "POST" }),
  rejectVerification: (id, reason) => req(`/admin/coach-verifications/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  getUsers: (role = "", search = "", status = "", page = 1, limit = 20) => {
    const params = new URLSearchParams();
    if (role) params.append("role", role);
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    params.append("page", String(page));
    params.append("limit", String(limit));
    return req(`/admin/users?${params.toString()}`);
  },
  suspendUser: (id, reason, duration_days = null, suspended_until = null) =>
    req(`/admin/users/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason, duration_days, suspended_until })
    }),
  contactUser: (id, subject, message) =>
    req(`/admin/users/${id}/contact`, {
      method: "POST",
      body: JSON.stringify({ subject, message })
    }),
  contactCoachReport: (reportId, subject, message) =>
    req(`/admin/reports/${reportId}/contact-coach`, {
      method: "POST",
      body: JSON.stringify({ subject, message })
    }),
  reinstateUser: (id) => req(`/admin/users/${id}/reinstate`, { method: "POST" }),
  getReports: (type = "", status = "", page = 1, limit = 20) => {
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    if (status) params.append("status", status);
    params.append("page", String(page));
    params.append("limit", String(limit));
    return req(`/admin/reports?${params.toString()}`);
  },
  getReportDetail: (id) => req(`/admin/reports/${id}`),
  resolveReport: (id, admin_notes, action_taken) => req(`/admin/reports/${id}/resolve`, { method: "POST", body: JSON.stringify({ admin_notes, action_taken }) }),
  dismissReport: (id, admin_notes) => req(`/admin/reports/${id}/dismiss`, { method: "POST", body: JSON.stringify({ admin_notes }) }),
  getAuditLog: (adminId = "", actionType = "", page = 1, limit = 20) => {
    const params = new URLSearchParams();
    if (adminId) params.append("admin_id", adminId);
    if (actionType) params.append("action_type", actionType);
    params.append("page", String(page));
    params.append("limit", String(limit));
    return req(`/admin/audit-log?${params.toString()}`);
  },
};

// ── User Reports API Client ────────────────────────────────────
export const reports = {
  submitCoachReport: (coach_id, category, description) =>
    req("/reports/coach", { method: "POST", body: JSON.stringify({ coach_id, category, description }) }),
  submitBugReport: (category, description, screenshot_url = null, app_context = null) =>
    req("/reports/bug", { method: "POST", body: JSON.stringify({ category, description, screenshot_url, app_context }) }),
  getMyReports: () => req("/reports/mine"),
  replyToInquiry: (reportId, reply) =>
    req(`/reports/${reportId}/inquiry-reply`, { method: "POST", body: JSON.stringify({ reply }) }),
};


