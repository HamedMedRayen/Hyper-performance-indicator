import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.title = "HPI — The Next Layer of Performance";

    const handleScroll = () => {
      const stage = document.getElementById("hpi-scroll-container");
      if (stage) {
        setScrolled(stage.scrollTop > 50);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth / window.innerHeight > 1.1) {
        setIsOpen(false);
      }
    };

    const stageEl = document.getElementById("hpi-scroll-container");
    if (stageEl) {
      stageEl.addEventListener("scroll", handleScroll);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      if (stageEl) {
        stageEl.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleSignUp = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
    navigate("/auth?mode=signup");
  };

  const handleSignIn = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
    navigate("/auth?mode=signin");
  };

  const scrollToSection = (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className={`hpi-landing-root ${isOpen ? "is-open" : ""}`} id="hpi-scroll-container">
      <style>{`
        /* ══════════════════════════════════════════════════════════
           COLOR TOKENS & RESPONSIVE UNIT SYSTEM
           ══════════════════════════════════════════════════════════ */
        .hpi-landing-root {
          --ink: #fafafa;
          --muted: #a7a6a6;
          --nav: #b6b5b5;
          --pill: #ffffff;
          --pill-ink: #050505;
          --bg: #050505;

          /* Desktop Reference Canvas: 1487 x 1058 */
          --u: calc(100vh / 1058);
          --uw: calc(100vw / 1487);
          --h: clamp(calc(var(--u) * 0.88), calc(var(--u) * .65 + var(--uw) * .35), calc(var(--u) * 1.16));

          --ease: cubic-bezier(.22, 1, .36, 1);

          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scroll-behavior: smooth;
          background: var(--bg) !important;
          color: var(--ink);
          font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
          z-index: 1000;
        }

        @supports (height: 100dvh) {
          .hpi-landing-root {
            --u: calc(100dvh / 1058);
          }
        }

        .hpi-landing-root *,
        .hpi-landing-root *::before,
        .hpi-landing-root *::after {
          box-sizing: border-box;
        }

        /* ── Focus Outline Style ───────────────────────────── */
        .hpi-landing-root *:focus:not(:focus-visible),
        .hpi-landing-root a:focus:not(:focus-visible),
        .hpi-landing-root button:focus:not(:focus-visible) {
          outline: none !important;
          box-shadow: none !important;
        }
        .hpi-landing-root a:focus-visible,
        .hpi-landing-root button:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.4) !important;
          outline-offset: 3px !important;
        }

        /* ══════════════════════════════════════════════════════════
           HERO STAGE: FULL-WIDTH VIDEO UNDERNEATH WITH SOFT ASYMMETRIC
           GRADIENT OVERLAY — ZERO HARD SEAMS OR BOUNDARIES
           ══════════════════════════════════════════════════════════ */
        .hpi-hero-stage {
          position: relative;
          width: 100vw;
          min-height: 100vh;
          min-height: 100dvh;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          background: radial-gradient(circle at 50% 50%, #16181d 0%, #0a0b0d 65%, #050505 100%);
          display: flex;
          align-items: center;
        }

        .hpi-hero-stage .plate {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        .hpi-hero-stage .plate-video {
          position: absolute;
          inset: -4%;
          width: 108% !important;
          height: 108% !important;
          min-width: 108% !important;
          min-height: 108% !important;
          max-width: none !important;
          max-height: none !important;
          object-fit: cover !important;
          object-position: center center !important;
          transform: scale(0.88);
          transform-origin: center center;
          pointer-events: none;
          background: transparent;
          display: block;
          filter: contrast(1.04) brightness(0.98);
        }

        /* Left and right side degradation (black & grey gradient fade)
           for cinematic framing, high sharpness, and perfect text contrast */
        .hpi-hero-stage .plate::after {
          content: "";
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
          background:
            /* Side degradation: Black -> Slate Grey -> Transparent -> Grey -> Black */
            linear-gradient(90deg,
              #050505 0%,
              rgba(10, 11, 14, 0.95) 8%,
              rgba(24, 27, 34, 0.75) 18%,
              rgba(28, 32, 40, 0.40) 30%,
              rgba(20, 22, 26, 0.10) 42%,
              transparent 52%,
              transparent 68%,
              rgba(20, 22, 26, 0.12) 78%,
              rgba(28, 32, 40, 0.45) 88%,
              rgba(12, 13, 16, 0.85) 95%,
              #050505 100%
            ),
            /* Subtle top and bottom degradation */
            linear-gradient(180deg,
              rgba(5, 5, 5, 0.7) 0%,
              transparent 14%,
              transparent 75%,
              rgba(8, 9, 11, 0.6) 88%,
              #050505 100%
            );
        }

        /* ── Header / Topbar Navigation ────────────────────── */
        .hpi-landing-root .topbar {
          position: fixed;
          inset: 0 0 auto 0;
          height: calc(92 * var(--u));
          min-height: 76px;
          z-index: 50;
          pointer-events: auto;
          display: flex;
          align-items: center;
          padding: 0 calc(75 * var(--u));
          background: linear-gradient(180deg, rgba(5, 5, 5, 0.96) 0%, rgba(8, 9, 11, 0.88) 75%, rgba(10, 11, 14, 0.80) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
          transition: background-color 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease;
        }

        .hpi-landing-root .topbar.scrolled {
          background: rgba(5, 5, 5, 0.96);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        /* Clean Logo Mark on Top-Left */
        .hpi-landing-root .brand {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: var(--ink);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.2s var(--ease);
        }
        .hpi-landing-root .brand:hover {
          opacity: 0.85;
          transform: translateY(-1px);
        }
        .hpi-landing-root .brand-logo-img {
          height: clamp(44px, calc(52 * var(--u)), 60px);
          width: auto;
          max-width: 220px;
          display: block;
          object-fit: contain;
        }

        /* Centered Nav Links */
        .hpi-landing-root .links {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: calc(28 * var(--u));
          font-size: calc(18.5 * var(--u));
          font-weight: 400;
          color: var(--nav);
          letter-spacing: -0.01em;
          white-space: nowrap;
        }
        .hpi-landing-root .links a,
        .hpi-landing-root .links button {
          color: var(--nav);
          background: none;
          border: none;
          padding: 6px 4px;
          cursor: pointer;
          font: inherit;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .hpi-landing-root .links a:hover,
        .hpi-landing-root .links button:hover {
          color: var(--ink);
        }

        /* Header Right Actions */
        .hpi-landing-root .topbar-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: calc(24 * var(--u));
        }

        .hpi-landing-root .nav-signin {
          font-size: calc(18.5 * var(--u));
          font-weight: 400;
          color: var(--nav);
          letter-spacing: -0.01em;
          text-decoration: none;
          white-space: nowrap;
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s ease;
          padding: 6px 0;
        }
        .hpi-landing-root .nav-signin:hover {
          color: var(--ink);
        }

        .hpi-landing-root .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--pill);
          color: var(--pill-ink);
          border-radius: 9999px;
          font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
          transition: transform 0.2s var(--ease), opacity 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
          border: none;
        }
        .hpi-landing-root .pill:hover {
          opacity: 0.94;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(255, 255, 255, 0.15);
        }
        .hpi-landing-root .pill:active {
          transform: translateY(0);
          opacity: 0.88;
        }

        .hpi-landing-root .pill-nav {
          width: calc(175 * var(--u));
          height: calc(49 * var(--u));
          min-width: 135px;
          min-height: 42px;
          font-size: calc(19.5 * var(--u));
        }
        .hpi-landing-root .pill-nav span {
          transform: translateY(calc(1 * var(--u)));
          display: inline-block;
        }

        .hpi-landing-root .burger { display: none; }
        .hpi-landing-root .menu { display: none; }

        /* ── Hero Typography (Solid Left Area) ─────────────── */
        .hpi-hero-stage .hero-content {
          position: relative;
          z-index: 10;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          padding: 0 max(24px, calc(65 * var(--u)));
          pointer-events: none;
        }

        .hpi-hero-stage .hero-text-wrap {
          max-width: min(520px, 36vw);
          pointer-events: auto;
        }

        .hpi-hero-stage .headline {
          font-size: clamp(32px, calc(44 * var(--h)), 50px);
          line-height: 1.12;
          font-weight: 400;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin: 0 0 clamp(14px, calc(18 * var(--h)), 22px) 0;
          white-space: normal;
          pointer-events: none;
        }
        .hpi-hero-stage .headline span { display: block; }

        .hpi-hero-stage .sub {
          font-size: clamp(13.5px, calc(16 * var(--h)), 17px);
          line-height: 1.5;
          font-weight: 400;
          color: var(--muted);
          margin: 0 0 clamp(20px, calc(28 * var(--h)), 34px) 0;
          pointer-events: none;
          white-space: normal;
        }
        .hpi-hero-stage .sub span { display: block; }

        .hpi-hero-stage .actions {
          display: flex;
          align-items: center;
          gap: clamp(16px, calc(24 * var(--h)), 28px);
          pointer-events: auto;
          z-index: 15;
        }

        .hpi-hero-stage .pill-cta {
          width: calc(175.6 * var(--h));
          height: calc(50 * var(--h));
          min-width: 140px;
          min-height: 44px;
          font-size: calc(20.6 * var(--h));
        }
        .hpi-hero-stage .pill-cta span {
          transform: translateY(calc(1 * var(--h)));
          display: inline-block;
        }

        .hpi-hero-stage .ghost {
          font-size: calc(20.6 * var(--h));
          font-weight: 500;
          letter-spacing: calc(0.12 * var(--h));
          color: #ffffff;
          text-decoration: none;
          white-space: nowrap;
          transition: opacity 0.2s ease, transform 0.2s ease;
          display: inline-flex;
          align-items: center;
          padding: calc(6 * var(--h)) 0;
          cursor: pointer;
          background: none;
          border: none;
          font-family: inherit;
        }
        .hpi-hero-stage .ghost:hover {
          opacity: 0.8;
          transform: translateX(2px);
        }

        /* ══════════════════════════════════════════════════════════
           CONTENT SECTIONS (ABOUT, FEATURES, ARCHITECTURE, FAQ, CONTACT)
           ══════════════════════════════════════════════════════════ */
        .landing-sections-wrap {
          position: relative;
          z-index: 20;
          background: #050505;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        .landing-section {
          padding: 100px max(24px, calc(75 * var(--u)));
          max-width: 1280px;
          margin: 0 auto;
          scroll-margin-top: 80px;
        }

        .section-eyebrow {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--muted);
          margin-bottom: 12px;
          font-weight: 600;
        }

        .section-heading {
          font-size: clamp(32px, 3.2vw, 46px);
          font-weight: 400;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin-bottom: 24px;
          line-height: 1.15;
        }

        .section-body {
          font-size: clamp(16px, 1.2vw, 19px);
          line-height: 1.65;
          color: var(--muted);
          max-width: 860px;
          margin-bottom: 32px;
        }

        /* Features Grid */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-top: 40px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 32px 28px;
          transition: border-color 0.25s ease, transform 0.25s ease;
        }
        .feature-card:hover {
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-2px);
        }
        .feature-title {
          font-size: 19px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        .feature-desc {
          font-size: 15px;
          line-height: 1.55;
          color: var(--muted);
          margin: 0;
        }

        /* Architecture Panel */
        .architecture-panel {
          background: radial-gradient(circle at top right, rgba(30, 30, 35, 0.4), rgba(10, 10, 12, 0.95));
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 44px 40px;
          margin-top: 32px;
        }
        .pipeline-flow {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-top: 36px;
        }
        .pipeline-step {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }
        .pipeline-step-num {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--nav);
          margin-bottom: 8px;
          font-weight: 600;
        }
        .pipeline-step-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 8px;
        }
        .pipeline-step-desc {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.5;
          margin: 0;
        }

        /* FAQ List */
        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 36px;
          max-width: 900px;
        }
        .faq-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 28px;
        }
        .faq-question {
          font-size: 18px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 10px;
          letter-spacing: -0.01em;
        }
        .faq-answer {
          font-size: 15px;
          line-height: 1.6;
          color: var(--muted);
          margin: 0;
        }

        /* Contact Section */
        .contact-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
          margin-top: 32px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }
        .contact-info {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .contact-email-link {
          display: inline-block;
          font-size: 20px;
          color: var(--ink);
          text-decoration: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.3);
          padding-bottom: 4px;
          margin-top: 16px;
          transition: border-color 0.2s ease;
        }
        .contact-email-link:hover { border-color: #fff; }
        .contact-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .contact-input {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 12px 16px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
        }
        .contact-input:focus { border-color: rgba(255, 255, 255, 0.4); }
        .contact-textarea { min-height: 100px; resize: vertical; }

        /* Footer */
        .landing-footer {
          padding: 60px max(24px, calc(75 * var(--u)));
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--muted);
          font-size: 14px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .footer-links {
          display: flex;
          gap: 24px;
        }
        .footer-links a {
          color: var(--muted);
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .footer-links a:hover { color: var(--ink); }

        /* ── Entrance Animations ───────────────────────────── */
        @keyframes hpiRise {
          from { opacity: 0; transform: translateY(calc(14 * var(--u))); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: no-preference) {
          .hpi-hero-stage .hero-text-wrap .headline { animation: hpiRise 0.9s var(--ease) 0.06s both; }
          .hpi-hero-stage .hero-text-wrap .sub { animation: hpiRise 0.9s var(--ease) 0.14s both; }
          .hpi-hero-stage .hero-text-wrap .actions { animation: hpiRise 0.9s var(--ease) 0.22s both; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hpi-landing-root * {
            animation: none !important;
            transition-duration: 0.001s !important;
          }
        }

        /* ── Mobile / Portrait Styles ──────────────────────── */
        @media (max-aspect-ratio: 11/10) {
          .hpi-landing-root {
            --m: min(calc(100vw / 430), 1.34px);
            --u: var(--m);
            --h: var(--m);
          }

          .hpi-landing-root .topbar {
            padding: 0 20px;
            height: 70px;
          }

          .hpi-landing-root .links,
          .hpi-landing-root .topbar-right {
            display: none !important;
          }

          .hpi-hero-stage {
            height: auto;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: max(95px, env(safe-area-inset-top)) 20px 40px 20px;
          }

          .hpi-hero-stage .plate-video {
            position: absolute;
            inset: 0;
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            object-position: center center !important;
          }

          .hpi-hero-stage .plate::after {
            background:
              linear-gradient(to bottom,
                rgba(5,5,5,0.45) 0%,
                rgba(5,5,5,0.70) 45%,
                rgba(5,5,5,0.92) 80%,
                #050505 100%
              );
          }

          .hpi-hero-stage .hero-content {
            padding: 0;
            height: auto;
          }

          .hpi-hero-stage .hero-text-wrap {
            max-width: 100%;
          }

          .hpi-hero-stage .headline {
            font-size: clamp(32px, calc(42 * var(--m)), 48px);
            line-height: 1.12;
            white-space: normal;
            margin-bottom: 14px;
          }
          .hpi-hero-stage .headline span { display: inline; }

          .hpi-hero-stage .sub {
            font-size: clamp(14px, calc(16 * var(--m)), 18px);
            line-height: 1.45;
            white-space: normal;
            word-spacing: normal;
            max-width: 100%;
            margin-bottom: 24px;
          }
          .hpi-hero-stage .sub span { display: inline; }

          .hpi-hero-stage .actions {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
          }

          .hpi-hero-stage .pill-cta {
            width: 100%;
            height: 52px;
            font-size: 17px;
          }

          .hpi-hero-stage .ghost {
            margin-left: 0;
            justify-content: center;
            font-size: 16px;
            padding: 10px 0;
            color: var(--muted);
          }

          .contact-box {
            grid-template-columns: 1fr;
            padding: 24px;
          }

          .landing-footer {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          /* Burger Menu */
          .hpi-landing-root .burger {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            width: 44px;
            height: 44px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 9999px;
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            cursor: pointer;
            z-index: 100;
            margin-left: auto;
          }
          .hpi-landing-root .burger i {
            display: block;
            width: 18px;
            height: 2px;
            background-color: var(--ink);
            border-radius: 2px;
            transition: transform 0.35s var(--ease), opacity 0.25s ease;
          }
          .hpi-landing-root.is-open .burger i:first-child {
            transform: translateY(4px) rotate(45deg);
          }
          .hpi-landing-root.is-open .burger i:last-child {
            transform: translateY(-4px) rotate(-45deg);
          }

          /* Mobile Drawer Overlay */
          .hpi-landing-root .menu {
            display: flex;
            position: fixed;
            inset: 0;
            background: radial-gradient(circle at 80% 20%, rgba(25, 25, 25, 0.98), rgba(5, 5, 5, 0.99) 70%);
            backdrop-filter: blur(28px);
            -webkit-backdrop-filter: blur(28px);
            z-index: 90;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity 0.42s var(--ease), visibility 0.42s ease;
            padding: max(90px, env(safe-area-inset-top)) 28px 36px 28px;
            flex-direction: column;
            justify-content: space-between;
          }
          .hpi-landing-root.is-open .menu {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
          }
          .hpi-landing-root .menu-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .hpi-landing-root .menu-list button,
          .hpi-landing-root .menu-list a {
            font-size: 26px;
            font-weight: 500;
            color: var(--ink);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 0;
            text-decoration: none;
            background: none;
            border: none;
            width: 100%;
            text-align: left;
            cursor: pointer;
            font-family: inherit;
          }
        }
      `}</style>

      {/* ── Fixed Header Navigation ───────────────────────── */}
      <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
        <button
          type="button"
          className="brand"
          onClick={() => {
            const stage = document.getElementById("hpi-scroll-container");
            if (stage) stage.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="Home"
        >
          <img
            src="/logo/hpi-logo-transparent.png"
            alt="HPI Logo"
            className="brand-logo-img"
          />
        </button>

        <nav className="links" aria-label="Primary">
          <button type="button" onClick={(e) => scrollToSection("about", e)}>About</button>
          <button type="button" onClick={(e) => scrollToSection("features", e)}>Features</button>
          <button type="button" onClick={(e) => scrollToSection("architecture", e)}>Architecture</button>
          <button type="button" onClick={(e) => scrollToSection("faq", e)}>FAQ</button>
          <button type="button" onClick={(e) => scrollToSection("contact", e)}>Contact</button>
        </nav>

        <div className="topbar-right">
          <button type="button" className="nav-signin" onClick={handleSignIn}>
            Sign In
          </button>
          <button type="button" className="pill pill-nav" onClick={handleSignUp}>
            <span>Get Started</span>
          </button>
        </div>

        <button
          type="button"
          className="burger"
          id="burger"
          aria-label={isOpen ? "Close menu" : "Toggle menu"}
          aria-expanded={isOpen}
          aria-controls="menu"
          onClick={() => setIsOpen(!isOpen)}
        >
          <i />
          <i />
        </button>
      </header>

      {/* ── Mobile Drawer ─────────────────────────────────── */}
      <nav className="menu" id="menu" aria-hidden={!isOpen}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '24px' }}>Menu</p>
            <ul className="menu-list">
              <li><button type="button" onClick={(e) => scrollToSection("about", e)}>About</button></li>
              <li><button type="button" onClick={(e) => scrollToSection("features", e)}>Features</button></li>
              <li><button type="button" onClick={(e) => scrollToSection("architecture", e)}>Architecture</button></li>
              <li><button type="button" onClick={(e) => scrollToSection("faq", e)}>FAQ</button></li>
              <li><button type="button" onClick={(e) => scrollToSection("contact", e)}>Contact</button></li>
              <li><button type="button" onClick={handleSignIn}>Sign In</button></li>
            </ul>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '36px' }}>
            <button type="button" className="pill" style={{ width: '100%', height: '52px', fontSize: '17px' }} onClick={handleSignUp}>
              <span>Get Started</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── 1) Hero Stage: Full-Width Video with Soft Asymmetric Gradient Blend ── */}
      <div className="hpi-hero-stage" id="hero">
        <div className="plate">
          <video className="plate-video" autoPlay muted loop playsInline preload="auto" aria-hidden="true">
            <source src="/hpi-reveal.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="hero-content">
          <div className="hero-text-wrap">
            <h1 className="headline">
              Where AI Coaching Meets Real Human Expertise.
            </h1>
            <p className="sub">
              Get instant, data-driven guidance from your AI coach and hands-on direction from real trainers all backed by advanced recovery and performance analytics.
            </p>
            <div className="actions">
              <button type="button" className="pill pill-cta" onClick={handleSignUp}>
                <span>Get Started</span>
              </button>
              <button type="button" className="ghost" onClick={(e) => scrollToSection("architecture", e)}>
                View Architecture
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2) In-Page Content Sections ───────────────────── */}
      <div className="landing-sections-wrap">

        {/* ── About Section ─────────────────────────────────── */}
        <section id="about" className="landing-section">
          <p className="section-eyebrow">Platform Overview</p>
          <h2 className="section-heading">About HPI</h2>
          <p className="section-body">
            HPI — Hyper Performance Indicator — is a unified performance-tracking platform built for athletes, coaches, and performance teams who need a single, reliable view of how training is translating into results. Instead of scattered spreadsheets and disconnected devices, HPI consolidates training load, recovery, and output metrics into one system, so decisions about programming and readiness are based on complete data rather than guesswork. The platform is built to sit quietly behind the training process: connecting to existing equipment and wearables, structuring the data automatically, and surfacing the signals that actually matter to performance staff.
          </p>
          <button type="button" className="pill" style={{ padding: '14px 28px', fontSize: '15px' }} onClick={handleSignUp}>
            Get Started
          </button>
        </section>

        {/* ── Features Section ──────────────────────────────── */}
        <section id="features" className="landing-section">
          <p className="section-eyebrow">Core Capabilities</p>
          <h2 className="section-heading">Features</h2>
          <p className="section-body">
            Engineered from first principles to optimize recovery, elevate output, and eliminate guesswork.
          </p>
          <div className="features-grid">
            <div className="feature-card">
              <h3 className="feature-title">Unified Data Layer</h3>
              <p className="feature-desc">
                Combine data from strength equipment, wearables, and manual entries into a single athlete profile, eliminating duplicate tracking across separate tools.
              </p>
            </div>
            <div className="feature-card">
              <h3 className="feature-title">Real-Time Readiness Metrics</h3>
              <p className="feature-desc">
                Surface load, recovery, and output trends as they happen, so coaching decisions can be made before a session rather than after.
              </p>
            </div>
            <div className="feature-card">
              <h3 className="feature-title">Team Dashboards</h3>
              <p className="feature-desc">
                Give coaching and performance staff a shared view across an entire roster, with individual athlete drill-down when needed.
              </p>
            </div>
            <div className="feature-card">
              <h3 className="feature-title">Benchmarking</h3>
              <p className="feature-desc">
                Compare current output against an athlete's own historical baseline or team-level norms, without manual spreadsheet work.
              </p>
            </div>
          </div>
        </section>

        {/* ── Architecture Section ──────────────────────────── */}
        <section id="architecture" className="landing-section">
          <p className="section-eyebrow">Systems Engineering</p>
          <h2 className="section-heading">Architecture</h2>
          <p className="section-body">
            HPI is built around a straightforward data pipeline: inputs from connected equipment and wearables are normalized into a single athlete-level data model, processed into the readiness and performance metrics shown on team and individual dashboards, and made available through a consistent interface for coaching staff. The system is designed to add new data sources without disrupting existing workflows, so a team's tracking setup can grow over time rather than requiring a full migration.
          </p>

          <div className="architecture-panel">
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>Pipeline Topology</h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', margin: 0 }}>End-to-end ingestion, computation, and telemetry distribution.</p>
            <div className="pipeline-flow">
              <div className="pipeline-step">
                <div className="pipeline-step-num">Step 01</div>
                <div className="pipeline-step-title">Ingestion Layer</div>
                <p className="pipeline-step-desc">Direct hardware adapters, wearable Bluetooth sync, and real-time exercise telemetry normalization.</p>
              </div>
              <div className="pipeline-step">
                <div className="pipeline-step-num">Step 02</div>
                <div className="pipeline-step-title">Vector & Compute Core</div>
                <p className="pipeline-step-desc">Asynchronous analysis pipeline calculating volume load curves, fatigue accumulation, and readiness scores.</p>
              </div>
              <div className="pipeline-step">
                <div className="pipeline-step-num">Step 03</div>
                <div className="pipeline-step-title">Performance Interface</div>
                <p className="pipeline-step-desc">Low-latency dashboard rendering, instant athlete drill-downs, and structured coach reviews.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ Section ───────────────────────────────────── */}
        <section id="faq" className="landing-section">
          <p className="section-eyebrow">Questions & Answers</p>
          <h2 className="section-heading">Frequently Asked Questions</h2>
          <div className="faq-list">
            <div className="faq-item">
              <h3 className="faq-question">What equipment does HPI work with?</h3>
              <p className="faq-answer">
                HPI is designed to integrate with common strength equipment and wearable devices used in performance training environments. Specific integration details are provided during onboarding based on the equipment already in use.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">Who is HPI built for?</h3>
              <p className="faq-answer">
                HPI is built for athletes, coaches, and performance staff who need a consolidated view of training data across a team or individual program.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">How is athlete data handled?</h3>
              <p className="faq-answer">
                Athlete data is stored securely and access is limited to authorized members of a team's performance staff. Full data-handling details are covered in the platform's data policy.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">How long does onboarding take?</h3>
              <p className="faq-answer">
                Onboarding timelines vary depending on the number of athletes and existing equipment being connected. A member of the team will walk through setup during account activation.
              </p>
            </div>
          </div>
        </section>

        {/* ── Contact Section ───────────────────────────────── */}
        <section id="contact" className="landing-section">
          <p className="section-eyebrow">Support & Inquiries</p>
          <h2 className="section-heading">Contact</h2>
          <p className="section-body">
            For questions about HPI, onboarding, or partnership inquiries, reach out to the team and a representative will follow up directly.
          </p>

          <div className="contact-box">
            <div className="contact-info">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>Direct Communication</h3>
                <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6' }}>
                  Our technical and sports science support team operates Monday through Friday across global training hubs.
                </p>
                <a href="mailto:support@hpi-performance.ai" className="contact-email-link">
                  support@hpi-performance.ai
                </a>
              </div>
              <div style={{ marginTop: '24px' }}>
                <p style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Institutional Inquiries</p>
                <p style={{ fontSize: '14px', color: 'var(--ink)', marginTop: '4px' }}>partners@hpi-performance.ai</p>
              </div>
            </div>

            <form className="contact-form" onSubmit={(e) => { e.preventDefault(); alert("Thank you. Your message has been received."); }}>
              <input type="text" placeholder="Your Name" required className="contact-input" />
              <input type="email" placeholder="Email Address" required className="contact-input" />
              <textarea placeholder="How can we assist your program?" required className="contact-input contact-textarea" />
              <button type="submit" className="pill" style={{ height: '46px', fontSize: '14px', marginTop: '4px' }}>
                Send Message
              </button>
            </form>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────── */}
        <footer className="landing-footer">
          <div>© 2026 HPI — Hyper Performance Indicator</div>
          <div className="footer-links">
            <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit' }} onClick={(e) => scrollToSection("about", e)}>About</button>
            <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit' }} onClick={(e) => scrollToSection("features", e)}>Features</button>
            <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit' }} onClick={(e) => scrollToSection("architecture", e)}>Architecture</button>
            <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit' }} onClick={handleSignIn}>Sign In</button>
          </div>
        </footer>

      </div>
    </div>
  );
}
