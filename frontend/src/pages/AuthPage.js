import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useTheme } from "../utils/theme";
import { HpiLogo } from "../utils/icons";
import { getApiBaseUrl } from "../utils/config";
import {
  Mail, ShieldCheck, User, Lock, ArrowRight, Dumbbell, Users, Server, Check,
  RefreshCw, Eye, EyeOff, Zap, Brain, Activity, Sparkles, Volume2, VolumeX,
  Play, Pause, Shield, CheckCircle2
} from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import OrbThemeSwitcher from "../components/layout/OrbThemeSwitcher";
import GrowthBackground from "../components/backgrounds/GrowthBackground";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, loginGoogle } = useAuth();
  const { theme, setTheme } = useTheme();

  const queryParams = new URLSearchParams(location.search);
  const initialMode =
    queryParams.get("mode") === "signup" || queryParams.get("mode") === "register"
      ? "register"
      : "login";

  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState(null); // null until user explicitly selects
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Video state
  const videoRef = useRef(null);

  // Ensure monochrome theme is active as the main theme for the Auth page
  useEffect(() => {
    if (theme !== "monochrome") {
      setTheme("monochrome");
    }
  }, []);

  // Server URL settings state
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(
    localStorage.getItem("custom_api_url") || getApiBaseUrl()
  );
  const [serverSavedMsg, setServerSavedMsg] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSaveServerUrl = () => {
    if (!serverUrl.trim()) {
      localStorage.removeItem("custom_api_url");
    } else {
      localStorage.setItem("custom_api_url", serverUrl.trim());
    }
    setServerSavedMsg("Server URL updated!");
    setTimeout(() => setServerSavedMsg(""), 3000);
  };

  const handleResetServerUrl = () => {
    localStorage.removeItem("custom_api_url");
    setServerUrl(getApiBaseUrl());
    setServerSavedMsg("Reset to default!");
    setTimeout(() => setServerSavedMsg(""), 3000);
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    if (next === "register") {
      setRole(null);
    }
  };

  // Password strength calculator
  const calculatePasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: "Empty", color: "#64748b" };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass) || pass.length >= 12) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: "Weak", color: "#ef4444" };
      case 2:
        return { score: 2, label: "Fair", color: "#f59e0b" };
      case 3:
        return { score: 3, label: "Good", color: "#3b82f6" };
      case 4:
        return { score: 4, label: "Elite", color: "#10b981" };
      default:
        return { score: 0, label: "Too short", color: "#ef4444" };
    }
  };

  const passStrength = calculatePasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        if (!nickname.trim() || !password)
          throw new Error("Nickname and password required.");
        await login(nickname, password, navigate);
      } else {
        if (!role)
          throw new Error("Please select a profile type (Athlete or Coach) to continue.");
        if (!nickname.trim() || !password || !email.trim())
          throw new Error("All fields are required.");
        if (password.length < 8)
          throw new Error("Password must be at least 8 characters.");
        if (password !== confirm)
          throw new Error("Passwords do not match.");
        await register(nickname, password, email, role, navigate);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      await loginGoogle(credentialResponse.credential, navigate);
    } catch {
      setError("Google Login failed.");
    }
  };

  const submitLabel = mode === "login" ? "Sign In" : "Create Account";

  return (
    <div className="orion-root orion-fullbleed-split">
      {/* ── Top Navigation Bar with Landing Page Style & Border ── */}
      <header className="orion-topbar-nav">
        <button
          type="button"
          className="orion-topbar-brand"
          onClick={() => navigate("/")}
          title="Return to Home"
        >
          <img
            src="/logo/hpi-logo-transparent.png"
            alt="HPI Logo"
            className="orion-topbar-logo"
          />
        </button>

        <div className="orion-topbar-right">
          <button
            type="button"
            className="orion-topbar-home-btn"
            onClick={() => navigate("/")}
          >
            ← Back to Home
          </button>
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            title="Server Settings"
            className="orion-top-action-btn"
          >
            <Server size={17} />
          </button>
          <OrbThemeSwitcher />
        </div>
      </header>

      {/* ── Main Split Container ───────────────────────────────── */}
      <div className="orion-split-fullscreen">
        
        {/* ═══════════════════════════════════════════════════════
            LEFT SIDE: FULL-BLEED VIDEO HERO (NO BORDER, EDGE-TO-EDGE)
            ═══════════════════════════════════════════════════════ */}
        <div className="orion-video-hero-side">
          <div className="orion-fullbleed-video-wrap">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className="orion-fullbleed-video"
            >
              <source src="/hpi-reveal.mp4" type="video/mp4" />
              <source src="/HPI_landing_page_code_generation_202608221249.mp4" type="video/mp4" />
            </video>

            {/* Seamless gradient blend into the black right panel */}
            <div className="orion-video-degradation" />
          </div>

          {/* Left Hero Headline Content (anchored top-left below topbar) */}
          <div className="orion-video-hero-content">
            <div className="orion-hero-brand-header">
              <h2 className="orion-hero-slogan">
                Coached by AI. Guided by Humans. <span className="orion-hero-gradient">Powered by Data.</span>
              </h2>
              <p className="orion-hero-caption">
                Real-time recovery analytics and adaptive training plans, built on a coach-to-athlete portal that blends machine intelligence with real expertise.
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT SIDE: FOCUSED BLACK AUTHENTICATION PANEL
            ═══════════════════════════════════════════════════════ */}
        <div className="orion-auth-side-panel">
          <div className={`orion-auth-content${mounted ? " orion-auth-in" : ""}`}>
            
            {/* Centered Logo */}
            <div className="orion-auth-logo-center">
              <img
                src="/logo/hpi-logo-transparent.png"
                alt="HPI Logo"
                className="orion-auth-main-logo"
              />
            </div>

            {/* Headline */}
            <div className="orion-heading">
              <h1 className="orion-title">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="orion-subtitle">
                {mode === "login"
                  ? "Sign in to access your precision performance data."
                  : "Join the next generation of data-driven athletic mastery."}
              </p>
            </div>

            {/* Server Config Dropdown / Box */}
            {showServerConfig && (
              <div className="orion-server-box">
                <div className="orion-server-head">
                  <span className="orion-server-label">Backend API Server</span>
                  {serverSavedMsg && (
                    <span className="orion-server-success">{serverSavedMsg}</span>
                  )}
                </div>
                <div className="orion-server-controls">
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://10.0.2.2:8000/api"
                    className="orion-server-input"
                  />
                  <button
                    type="button"
                    onClick={handleSaveServerUrl}
                    title="Save Server URL"
                    className="orion-server-btn-save"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetServerUrl}
                    title="Reset to Default"
                    className="orion-server-btn-reset"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <p className="orion-server-hint">
                  Default: <code>10.0.2.2:8000</code> (Android Emulator) or PC LAN IP.
                </p>
              </div>
            )}

            {/* Mode tabs */}
            <div className="orion-tabs" role="tablist">
              <button
                id="orion-tab-signin"
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={`orion-tab${mode === "login" ? " active" : ""}`}
                onClick={() => switchMode("login")}
              >
                Sign In
              </button>
              <button
                id="orion-tab-register"
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={`orion-tab${mode === "register" ? " active" : ""}`}
                onClick={() => switchMode("register")}
              >
                Register
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="orion-form" noValidate>
              
              {/* Role picker — register only */}
              {mode === "register" && (
                <div className="orion-field">
                  <div className="orion-role-header">
                    <label className="orion-label">1. Choose Account Type</label>
                    {!role && (
                      <span className="orion-role-required-badge">Required</span>
                    )}
                  </div>
                  <div className="orion-role-row">
                    {[
                      {
                        value: "athlete",
                        label: "Athlete",
                        icon: Dumbbell,
                        desc: "Track workouts & biometrics"
                      },
                      {
                        value: "coach",
                        label: "Coach",
                        icon: Users,
                        desc: "Manage roster & analytics"
                      }
                    ].map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        id={`orion-role-${r.value}`}
                        onClick={() => {
                          setRole(r.value);
                          setError(null);
                        }}
                        className={`orion-role-card${role === r.value ? " active" : ""}`}
                      >
                        <div className={`orion-role-icon${role === r.value ? " active" : ""}`}>
                          <r.icon size={18} />
                        </div>
                        <div className="orion-role-text-wrap">
                          <span className="orion-role-name">{r.label}</span>
                          <span className="orion-role-desc">{r.desc}</span>
                        </div>
                        {role === r.value && (
                          <CheckCircle2 size={16} className="orion-role-check" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Inputs and Action Buttons (Appears only after role is selected or in Login mode) ── */}
              {(mode === "login" || role !== null) && (
                <div className="orion-form-animated-fields">
                  <div className="orion-fields">
                    <div className="orion-field">
                      <label className="orion-label" htmlFor="orion-nick">
                        Nickname / Username
                      </label>
                      <div className="orion-input-wrap">
                        <User size={16} className="orion-input-icon" />
                        <input
                          id="orion-nick"
                          className="orion-input"
                          placeholder="e.g. ironathlete"
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          autoComplete="username"
                          autoCapitalize="none"
                          required
                        />
                      </div>
                    </div>

                    {mode === "register" && (
                      <div className="orion-field">
                        <label className="orion-label" htmlFor="orion-email">
                          Email Address
                        </label>
                        <div className="orion-input-wrap">
                          <Mail size={16} className="orion-input-icon" />
                          <input
                            id="orion-email"
                            className="orion-input"
                            type="email"
                            placeholder="athlete@domain.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="orion-field">
                      <div className="orion-label-row">
                        <label className="orion-label" htmlFor="orion-pw">
                          Password
                        </label>
                        {mode === "register" && password && (
                          <span
                            className="orion-strength-label"
                            style={{ color: passStrength.color }}
                          >
                            {passStrength.label}
                          </span>
                        )}
                      </div>
                      <div className="orion-input-wrap">
                        <Lock size={16} className="orion-input-icon" />
                        <input
                          id="orion-pw"
                          className="orion-input has-toggle"
                          type={showPassword ? "text" : "password"}
                          placeholder="min. 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete={
                            mode === "login" ? "current-password" : "new-password"
                          }
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="orion-pw-toggle"
                          title={showPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      {/* Password Strength Meter (Register Mode) */}
                      {mode === "register" && password && (
                        <div className="orion-strength-meter">
                          <div className="orion-strength-bars">
                            {[1, 2, 3, 4].map((step) => (
                              <div
                                key={step}
                                className="orion-strength-bar"
                                style={{
                                  background:
                                    passStrength.score >= step
                                      ? passStrength.color
                                      : "rgba(255, 255, 255, 0.1)"
                                }}
                              />
                            ))}
                          </div>
                          <div className="orion-strength-hints">
                            <span className={password.length >= 8 ? "valid" : ""}>
                              • 8+ chars
                            </span>
                            <span className={/[A-Z]/.test(password) ? "valid" : ""}>
                              • Uppercase
                            </span>
                            <span className={/[0-9]/.test(password) ? "valid" : ""}>
                              • Number
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {mode === "register" && (
                      <div className="orion-field">
                        <label className="orion-label" htmlFor="orion-confirm">
                          Confirm Password
                        </label>
                        <div className="orion-input-wrap">
                          <ShieldCheck size={16} className="orion-input-icon" />
                          <input
                            id="orion-confirm"
                            className="orion-input has-toggle"
                            type={showConfirm ? "text" : "password"}
                            placeholder="Repeat your password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            autoComplete="new-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="orion-pw-toggle"
                            title={showConfirm ? "Hide password" : "Show password"}
                            tabIndex={-1}
                          >
                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <div className="orion-error" role="alert" style={{ marginTop: "12px" }}>
                      <span className="orion-error-icon">!</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    id="orion-submit"
                    className="orion-submit"
                    type="submit"
                    disabled={loading}
                    style={{ marginTop: "14px" }}
                  >
                    {loading ? (
                      <span className="orion-spinner" />
                    ) : (
                      <>
                        <span>{submitLabel}</span>
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>

                  {/* Social Divider */}
                  <div className="orion-divider">
                    <span className="orion-divider-line" />
                    <span className="orion-divider-text">or continue with</span>
                    <span className="orion-divider-line" />
                  </div>

                  {/* Google OAuth Button */}
                  <div className="orion-google">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError("Google Login failed.")}
                      theme="filled_black"
                      shape="pill"
                      width="100%"
                    />
                  </div>
                </div>
              )}
            </form>

            {/* Switch Mode Prompt */}
            <p className="orion-switch">
              {mode === "login"
                ? "Don't have an account? "
                : "Already registered with HPI? "}
              <button
                type="button"
                id="orion-switch-btn"
                className="orion-switch-link"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create an account" : "Sign in here"}
              </button>
            </p>

            {/* Card bottom branding & secure badge */}
            <div className="orion-secure-footer">
              <Shield size={12} />
              <span>TLS 256-bit Encrypted • Zero-Trust Performance Cloud</span>
            </div>

            {/* Footer note */}
            <p className="orion-bottom-copyright">
              © 2026 HPI — Hyper Performance Indicator.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
