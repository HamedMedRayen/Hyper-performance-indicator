import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { ThemeContext, useThemeProvider, useTheme } from "./utils/theme";
import { AuthContext, useAuthProvider } from "./utils/auth";
import { useAuth } from "./utils/auth";

import IdentityPanel from "./components/layout/IdentityPanel";
import MainSidebar from "./components/layout/MainSidebar";
import MainHeader from "./components/layout/MainHeader";
import SubNav from "./components/layout/SubNav";
import BottomNav from "./components/layout/BottomNav";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { ToastProvider } from "./components/common/Toast";
import { SkeletonStyles } from "./components/common/SkeletonLoader";
import Skeleton from "./components/common/SkeletonLoader";

// Background effects — always loaded
import FireBackground from "./components/backgrounds/FireBackground";
import FlowerBackground from "./components/backgrounds/FlowerBackground";
import LeafBackground from "./components/backgrounds/LeafBackground";
import NightBackground from "./components/backgrounds/NightBackground";
import SkyBackground from "./components/backgrounds/SkyBackground";
import MainBackground from "./components/backgrounds/MainBackground";
import MonochromeBackground from "./components/backgrounds/MonochromeBackground";
import HpiChat from "./components/HpiChat/HpiChat";
import IncomingCallListener from "./components/video/IncomingCallListener";

// ── Lazy-loaded pages — code-split for faster initial load ──
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const AuthPage = React.lazy(() => import("./pages/AuthPage"));
const OnboardingFlow = React.lazy(() => import("./components/onboarding/OnboardingFlow"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Workouts = React.lazy(() => import("./pages/Workouts"));
const LogWorkout = React.lazy(() => import("./pages/LogWorkout"));
const Progress = React.lazy(() => import("./pages/Progress"));
const FatigueCheck = React.lazy(() => import("./pages/FatigueCheck"));
const Exercises = React.lazy(() => import("./pages/Exercises"));
const Recommend = React.lazy(() => import("./pages/Recommend"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Measurements = React.lazy(() => import("./pages/Measurements"));
const Nutrition = React.lazy(() => import("./pages/Nutrition"));
const ProgressPhotos = React.lazy(() => import("./pages/ProgressPhotos"));
const CoachDashboard = React.lazy(() => import("./pages/CoachDashboard"));
const InjuryLog = React.lazy(() => import("./pages/InjuryLog"));
const SleepTracker = React.lazy(() => import("./pages/SleepTracker"));
const Challenges = React.lazy(() => import("./pages/Challenges"));
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
import RequireAdmin from "./components/auth/RequireAdmin";

// ── Mobile App Shell ──
const MobileAppShell = React.lazy(() => import("./mobile/MobileAppShell"));

function PageLoader() {
  return <Skeleton.Dashboard />;
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/" replace />;

  const isAdmin = user.role === "admin" || user.profile?.role === "admin";
  const isCompleted = user.onboarding_completed === true || user.profile?.onboarding_completed === true || isAdmin;
  const isExplicitlyFalse = !isAdmin && (user.onboarding_completed === false || user.profile?.onboarding_completed === false) && !isCompleted;

  if (isExplicitlyFalse && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function PageWrap({ children }) {
  const { pathname } = useLocation();
  return <div key={pathname} className="page-slide-enter">{children}</div>;
}

function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const isAuth = location.pathname === "/auth";
  const isOnboarding = location.pathname === "/onboarding";
  const isLanding = location.pathname === "/landing" || (!user && location.pathname === "/");

  if (!user || isAuth || isLanding) {
    const isAdmin = user && (user.role === "admin" || user.profile?.role === "admin");
    return (
      <PageWrap>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={user ? <RequireAuth>{isAdmin ? <Navigate to="/admin" replace /> : <Dashboard />}</RequireAuth> : <LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<Navigate to={user ? (isAdmin ? "/admin" : "/") : "/"} replace />} />
          </Routes>
        </Suspense>
      </PageWrap>
    );
  }

  const isAdmin = user.role === "admin" || user.profile?.role === "admin";
  const isCompleted = user.onboarding_completed === true || user.profile?.onboarding_completed === true || isAdmin;
  const isExplicitlyFalse = !isAdmin && (user.onboarding_completed === false || user.profile?.onboarding_completed === false) && !isCompleted;

  if (isExplicitlyFalse || (isOnboarding && !isCompleted && !isAdmin)) {
    return (
      <PageWrap>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/onboarding" element={<RequireAuth><OnboardingFlow /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </Routes>
        </Suspense>
      </PageWrap>
    );
  }

  const { theme, previewTheme } = useTheme();
  const activeTheme = previewTheme || theme;
  const isMainArchitecture = activeTheme === 'main' || activeTheme === 'dark' || activeTheme === 'monochrome';

  return (
    <div className="app-shell">
      {isMainArchitecture ? <MainSidebar /> : <IdentityPanel />}
      <main className="main-content">
        {isMainArchitecture ? <MainHeader /> : <SubNav />}
        <PageWrap>
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary title="Page Error" message="This page encountered an error. Try refreshing." fullPage>
              <Routes>
                {/* Admin Accounts: Exclusively dedicated to Admin Management */}
                {isAdmin ? (
                  <>
                    <Route path="/" element={<Navigate to="/admin" replace />} />
                    <Route path="/admin/*" element={<RequireAuth><RequireAdmin><AdminDashboard /></RequireAdmin></RequireAuth>} />
                    <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </>
                ) : (
                  <>
                    <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                    <Route path="/onboarding" element={<RequireAuth><OnboardingFlow /></RequireAuth>} />
                    <Route path="/workouts" element={<RequireAuth><Workouts /></RequireAuth>} />
                    <Route path="/log" element={<RequireAuth><LogWorkout /></RequireAuth>} />
                    <Route path="/progress" element={<RequireAuth><Progress /></RequireAuth>} />
                    <Route path="/fatigue-check" element={<RequireAuth><FatigueCheck /></RequireAuth>} />

                    <Route path="/exercises" element={<RequireAuth><Exercises /></RequireAuth>} />
                    <Route path="/recommend" element={<RequireAuth><Recommend /></RequireAuth>} />
                    <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                    <Route path="/measurements" element={<RequireAuth><Measurements /></RequireAuth>} />
                    <Route path="/nutrition" element={<RequireAuth><Nutrition /></RequireAuth>} />
                    <Route path="/photos" element={<RequireAuth><ProgressPhotos /></RequireAuth>} />
                    <Route path="/injuries" element={<RequireAuth><InjuryLog /></RequireAuth>} />
                    <Route path="/sleep" element={<RequireAuth><SleepTracker /></RequireAuth>} />
                    <Route path="/challenges" element={<RequireAuth><Challenges /></RequireAuth>} />
                    <Route path="/coach/*" element={<RequireAuth><CoachDashboard /></RequireAuth>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </>
                )}
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </PageWrap>
        {!isMainArchitecture && !isAdmin && <BottomNav />}
      </main>
    </div>
  );
}

function ThemeOverlays() {
  const { theme, previewTheme } = useTheme();
  const activeTheme = previewTheme || theme;

  return (
    <>
      {activeTheme === 'fire' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 40%, rgba(0,0,0,0.92) 100%)',
        }} />
      )}
      {activeTheme === 'queen' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(135deg, rgba(253,240,249,0.5) 0%, rgba(255,255,255,0.2) 100%)',
        }} />
      )}
      {activeTheme === 'monochrome' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 100%)',
        }} />
      )}
    </>
  );
}

export default function App() {
  const themeValue = useThemeProvider();
  const authValue = useAuthProvider();
  return (
    <ThemeContext.Provider value={themeValue}>
      <AuthContext.Provider value={authValue}>
        <ToastProvider>
          <SkeletonStyles />
          {/* Background effects — fixed, zIndex 0, pointer-events none */}
          {!Capacitor.isNativePlatform() && (
            <>
              <FireBackground />
              <FlowerBackground />
              <LeafBackground />
              <NightBackground />
              <SkyBackground />
              <MainBackground />
              <MonochromeBackground />
              <ThemeOverlays />
            </>
          )}
          {/* All app UI sits above the backgrounds */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </div>
        </ToastProvider>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

function AppContent() {
  const location = useLocation();
  const { user } = useAuth();
  const isPublicPage = location.pathname === "/auth" || location.pathname === "/landing" || (!user && location.pathname === "/");
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
      // 1. Hide splash screen after app mount
      SplashScreen.hide().catch(() => { });

      // 2. Set status bar overlay and style (white icons for dark glassmorphism background)
      StatusBar.setStyle({ style: Style.Dark }).catch(() => { });
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => { });

      // 3. Configure keyboard
      Keyboard.setAccessoryBarVisible({ visible: false }).catch(() => { });
    }
  }, [isNative]);

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        {isNative ? <MobileAppShell /> : <AppShell />}
      </Suspense>
      {!isPublicPage && <HpiChat />}
      {!isPublicPage && <IncomingCallListener />}

      {!isNative && (
        <style>{`
          .glass, .card, .themed-card, [class*="card"], [class*="glass"] {
            border: 1.5px solid var(--border-card) !important;
            box-shadow: var(--shadow-card) !important;
            backdrop-filter: blur(12px) !important;
            -webkit-backdrop-filter: blur(12px) !important;
          }
          .input-base, .themed-input, input[type="text"]:not(.main-search-input), input[type="number"]:not(.main-search-input), select {
            border: 1.5px solid var(--border-input) !important;
          }
          .main-search-input {
            border: none !important;
            border-style: none !important;
            outline: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          hr {
            border-top: 1.5px solid var(--border-card) !important;
            opacity: 1 !important;
          }
        `}</style>
      )}
    </>
  );
}

