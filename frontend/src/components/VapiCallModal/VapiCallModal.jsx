import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Settings,
  X,
  Bot,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Volume2,
  Key
} from "lucide-react";
import "./VapiCallModal.css";
import {
  getVapiCredentials,
  fetchVapiCredentials,
  setVapiCredentials,
  getVapiInstance,
  fetchVapiContext,
  syncVapiTranscriptToBackend
} from "../../utils/vapiService";
import { addChatMessages, isSystemPromptMessage } from "../../utils/chatStorage";

export default function VapiCallModal({ isOpen, onClose }) {
  const [callState, setCallState] = useState("idle"); // idle, connecting, connected, speaking, listening, error
  const [errorMessage, setErrorMessage] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);
  const [transcripts, setTranscripts] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  // Credentials state
  const [pubKey, setPubKey] = useState("");
  const [assistantId, setAssistantId] = useState("");

  const vapiRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const pubKeyRef = useRef(pubKey);
  const assistantIdRef = useRef(assistantId);
  const transcriptsRef = useRef(transcripts);
  const hasSyncedCallRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    pubKeyRef.current = pubKey;
  }, [pubKey]);

  useEffect(() => {
    assistantIdRef.current = assistantId;
  }, [assistantId]);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  // Helper to persist voice call messages to HpiChat and trigger backend actions
  const syncCallToChatAndBackend = useCallback(async () => {
    if (hasSyncedCallRef.current) return;
    hasSyncedCallRef.current = true;

    const currentTranscripts = transcriptsRef.current || [];
    if (currentTranscripts.length === 0) return;

    const formattedMessages = currentTranscripts
      .filter((t) => t.text && t.text.trim() && !isSystemPromptMessage(t))
      .filter((t) => t.role === "User" || t.role === "user" || t.role === "Hpi AI" || t.role === "assistant")
      .map((t) => ({
        role: t.role === "User" || t.role === "user" ? "user" : "assistant",
        content: `🎙️ ${t.text.trim()}`
      }));

    if (formattedMessages.length > 0) {
      addChatMessages(formattedMessages);
      await syncVapiTranscriptToBackend(currentTranscripts);
    }
  }, []);

  // Start Call Function with stable reference
  const handleStartCall = useCallback(async (keyOverride, astOverride) => {
    let key = (keyOverride || pubKeyRef.current || "").trim();
    let ast = (astOverride || assistantIdRef.current || "").trim();

    if (!key || !ast) {
      const fetched = await fetchVapiCredentials();
      key = (fetched.publicKey || key || "").trim();
      ast = (fetched.assistantId || ast || "").trim();
      if (key) setPubKey(key);
      if (ast) setAssistantId(ast);
    }

    if (!key || !ast) {
      setShowSettings(true);
      return;
    }

    // 1. Request Microphone Access explicitly & Unlock AudioContext
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
      }
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (micErr) {
      console.error("Microphone permission / AudioContext error:", micErr);
      setCallState("error");
      setErrorMessage("Microphone access denied. Please allow microphone permissions in your browser settings.");
      return;
    }

    setCallState("connecting");
    setErrorMessage("");
    setDuration(0);
    setTranscripts([]);
    hasSyncedCallRef.current = false;

    try {
      const vapi = getVapiInstance(key);
      if (!vapi) {
        throw new Error("Could not initialize Vapi SDK.");
      }
      vapiRef.current = vapi;

      // Fetch dynamic Hpi profile & prompt context from backend
      const vapiContext = await fetchVapiContext();

      // Clean up previous event listeners to prevent duplicate triggers
      vapi.removeAllListeners();

      // Event Handlers
      vapi.on("call-start", () => {
        console.log("Vapi call started successfully");
        setCallState("connected");
        setIsMuted(false);
        try {
          vapi.setMuted(false);
        } catch (mErr) {
          console.warn("Could not setMuted:", mErr);
        }
      });

      vapi.on("call-start-progress", (progress) => {
        console.log("Vapi call progress:", progress);
      });

      vapi.on("call-start-failed", (evt) => {
        console.error("Vapi call start failed:", evt);
        setCallState("error");
        const errMsg = evt?.error || evt?.message || "Failed to start call with Vapi.";
        setErrorMessage(`Call failed: ${errMsg}`);
      });

      vapi.on("call-end", () => {
        console.log("Vapi call ended");
        setCallState("idle");
        setVolumeLevel(0);
        syncCallToChatAndBackend();
      });

      vapi.on("speech-start", () => {
        setCallState("speaking");
      });

      vapi.on("speech-end", () => {
        setCallState("connected");
      });

      vapi.on("volume-level", (vol) => {
        setVolumeLevel(vol || 0);
      });

      vapi.on("local-volume-level", (vol) => {
        if (vol > 0.02) {
          setVolumeLevel(vol);
        }
      });

      vapi.on("message", (msg) => {
        console.log("Vapi message:", msg);
        if (msg.type === "transcript") {
          if (msg.role === "system") return;
          const text = msg.transcript;
          if (text && !isSystemPromptMessage({ content: text })) {
            const role = msg.role === "user" ? "User" : "Hpi AI";
            setTranscripts((prev) => {
              if (prev.length > 0 && prev[prev.length - 1].role === role && msg.transcriptType === "partial") {
                const next = [...prev];
                next[next.length - 1] = { role, text, type: msg.transcriptType };
                return next;
              }
              return [...prev, { role, text, type: msg.transcriptType }];
            });
          }
        } else if (msg.type === "conversation-update" && Array.isArray(msg.conversation)) {
          const parsed = msg.conversation
            .filter((item) => item && item.role !== "system")
            .map((item) => ({
              role: item.role === "user" ? "User" : "Hpi AI",
              text: item.content || item.text || ""
            }))
            .filter((x) => x.text && !isSystemPromptMessage({ content: x.text }));
          if (parsed.length > 0) {
            setTranscripts(parsed);
          }
        }
      });

      vapi.on("error", (err) => {
        console.error("Vapi Error:", err);
        const detail = typeof err === "string" ? err : (err?.message || err?.error || JSON.stringify(err));
        setCallState("error");
        setErrorMessage(`Vapi error: ${detail}`);
      });

      // Launch Call with dynamic Hpi assistant overrides if available
      console.log("Starting Vapi call with assistant ID:", ast);
      if (vapiContext?.assistant_overrides) {
        console.log("Applying Hpi AI backend dynamic context to Vapi call:", vapiContext.assistant_overrides);
        await vapi.start(ast, vapiContext.assistant_overrides);
      } else {
        await vapi.start(ast);
      }
    } catch (err) {
      console.error("Call start failed:", err);
      setCallState("error");
      setErrorMessage(err.message || "Failed to start call. Check API key and Assistant ID.");
    }
  }, [syncCallToChatAndBackend]);

  // Load credentials on open
  useEffect(() => {
    if (isOpen) {
      fetchVapiCredentials().then((creds) => {
        const key = (creds.publicKey || "").trim();
        const ast = (creds.assistantId || "").trim();
        if (key) setPubKey(key);
        if (ast) setAssistantId(ast);

        if (!key || !ast) {
          setShowSettings(true);
        } else {
          setShowSettings(false);
          // Auto start call on modal open
          handleStartCall(key, ast);
        }
      });
    }
  }, [isOpen, handleStartCall]);

  // Duration Timer
  useEffect(() => {
    if (callState === "connected" || callState === "speaking" || callState === "listening") {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Scroll to bottom of transcript
  useEffect(() => {
    if (showTranscript && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, showTranscript]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // End Call
  const handleEndCall = useCallback(() => {
    syncCallToChatAndBackend();
    if (vapiRef.current) {
      try {
        vapiRef.current.stop();
      } catch (e) {
        console.error("Error stopping vapi:", e);
      }
    }
    setCallState("idle");
    setVolumeLevel(0);
  }, [syncCallToChatAndBackend]);

  // Toggle Mute
  const handleToggleMute = useCallback(() => {
    if (vapiRef.current) {
      const nextMute = !isMuted;
      vapiRef.current.setMuted(nextMute);
      setIsMuted(nextMute);
    }
  }, [isMuted]);

  // Save Settings & Auto-Call
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setVapiCredentials(pubKey, assistantId);
    setShowSettings(false);
    if (pubKey.trim() && assistantId.trim()) {
      handleStartCall(pubKey, assistantId);
    }
  };

  const handleClose = () => {
    if (callState !== "idle") {
      handleEndCall();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="vapi-call-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="vapi-call-card">
        {/* Header */}
        <div className="vapi-call-header">
          <div className={`vapi-badge ${callState}`}>
            <span className="vapi-pulse-dot" />
            {callState === "idle" && "Ready"}
            {callState === "connecting" && "Dialing Hpi AI..."}
            {callState === "connected" && "In Call"}
            {callState === "speaking" && "Hpi is speaking"}
            {callState === "listening" && "Listening to you"}
            {callState === "error" && "Call Error"}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="vapi-close-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="Voice Call Settings"
            >
              <Settings size={18} />
            </button>
            <button className="vapi-close-btn" onClick={handleClose} title="Close Interface">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {showSettings ? (
          <form onSubmit={handleSaveSettings} className="vapi-config-container">
            <div className="vapi-config-title">
              <Key className="text-cyan-400" size={20} />
              Voice Call Key Setup
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
              Enter your Voice Call credentials below to speak directly with your AI coach in real-time.
            </p>

            <div className="vapi-field">
              <label>Public Key / API Key</label>
              <input
                type="text"
                placeholder="e.g. 81a6... or pk_..."
                value={pubKey}
                onChange={(e) => setPubKey(e.target.value)}
                required
              />
            </div>

            <div className="vapi-field">
              <label>Voice Assistant ID</label>
              <input
                type="text"
                placeholder="e.g. 5f8a..."
                value={assistantId}
                onChange={(e) => setAssistantId(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="vapi-save-btn">
              Save & Start Voice Call
            </button>
          </form>
        ) : (
          <>
            {/* Avatar & Visualizer */}
            <div className="vapi-avatar-section">
              <div className="vapi-avatar-wrapper">
                <div
                  className="vapi-orb-glow"
                  style={{
                    transform: `scale(${1 + volumeLevel * 1.5})`,
                    opacity: callState !== "idle" ? 0.8 + volumeLevel * 0.2 : 0.3
                  }}
                />
                {callState !== "idle" && (
                  <>
                    <div className="vapi-avatar-ring" />
                    <div className="vapi-avatar-ring" />
                  </>
                )}
                <div
                  className="vapi-avatar-core"
                  style={{
                    transform: `scale(${1 + volumeLevel * 0.15})`
                  }}
                >
                  <Bot size={48} className="vapi-avatar-icon" />
                </div>
              </div>

              <div className="vapi-caller-title">Hpi Voice Coach</div>
              <div className="vapi-call-timer">
                {callState === "idle" ? "Tap call to connect" : formatTimer(duration)}
              </div>

              {/* Dynamic Equalizer Bars */}
              {callState !== "idle" && (
                <div className="vapi-visualizer">
                  {[0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.4, 0.6, 0.3, 0.75].map((factor, idx) => {
                    const h = Math.max(4, Math.min(32, volumeLevel * 100 * factor + (callState === 'speaking' ? 8 : 4)));
                    return (
                      <div
                        key={idx}
                        className="vapi-bar"
                        style={{ height: `${h}px` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error Banner if any */}
            {errorMessage && (
              <div style={{
                margin: "0 20px 10px",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Live Transcript drawer toggle */}
            {callState !== "idle" && (
              <>
                <button
                  className="vapi-transcript-toggle"
                  onClick={() => setShowTranscript(!showTranscript)}
                >
                  <MessageSquare size={14} />
                  {showTranscript ? "Hide Transcript" : "Show Live Transcript"}
                </button>

                {showTranscript && (
                  <div className="vapi-transcript-box">
                    {transcripts.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", fontStyle: "italic" }}>
                        Say something... Hpi is listening!
                      </div>
                    ) : (
                      transcripts.map((t, idx) => (
                        <div key={idx} className={`vapi-transcript-msg ${t.role === 'User' ? 'user' : 'assistant'}`}>
                          <strong>{t.role}: </strong>
                          {t.text}
                        </div>
                      ))
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                )}
              </>
            )}

            {/* Controls Bar */}
            <div className="vapi-controls">
              {callState !== "idle" ? (
                <>
                  <button
                    className={`vapi-btn-circle ${isMuted ? "active" : ""}`}
                    onClick={handleToggleMute}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>

                  <button
                    className="vapi-btn-circle call-end"
                    onClick={handleEndCall}
                    title="End Call"
                  >
                    <PhoneOff size={28} />
                  </button>
                </>
              ) : (
                <button
                  className="vapi-btn-circle call-start"
                  onClick={() => handleStartCall()}
                  title="Start Call"
                >
                  <Phone size={28} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
