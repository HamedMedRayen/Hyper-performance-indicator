import React, { useState, useEffect, useRef } from "react";
import { Mic, Send, X, MicOff, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Keyboard } from "@capacitor/keyboard";
import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "../../utils/config";
import { getSyncItem } from "../../utils/storage";
import { startListening, stopListening } from "../../utils/speechRecognition";
import { getChatHistory, saveChatHistory, subscribeChatHistory, isSystemPromptMessage, clearChatHistory } from "../../utils/chatStorage";
import MarkdownMessage from "../../components/common/MarkdownMessage";

export default function MobileChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState(() => getChatHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages(getChatHistory());
    const unsubscribe = subscribeChatHistory((updated) => {
      setMessages(updated);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setIsKeyboardOpen(true);
    });
    
    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setIsKeyboardOpen(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const handleSend = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    setError(null);
    const userMsg = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    saveChatHistory(updatedMessages);

    setInput("");
    setLoading(true);

    try {
      const token = getSyncItem("aura_token");
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg = { role: "assistant", content: data.reply };
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } catch (err) {
      setError(err.message || "Failed to reach HPI. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startVoice = () => {
    startListening({
      onResult: (transcript) => {
        setInput(transcript);
        setTimeout(() => handleSend(transcript), 300);
      },
      onError: (err) => {
        console.error("Voice input failed", err);
        setError("Voice input failed. Please speak clearly.");
      },
      onStart: () => setListening(true),
      onEnd: () => setListening(false)
    });
  };

  const stopVoice = () => {
    stopListening();
    setListening(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-app)" }}>
      {/* Header */}
      <div style={{ paddingTop: "env(safe-area-inset-top)", background: "rgba(15,17,21,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", padding: "16px 20px" }}>
        <button onClick={() => navigate(-1)} style={{ background: "var(--color-border)", border: "none", color: "var(--color-text)", width: 36, height: 36, borderRadius: 18, display: "flex", justifyContent: "center", alignItems: "center", marginRight: 16 }}>
          <X size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--color-text)" }}>HPI AI Assistant</h2>
          <span style={{ fontSize: 12, color: "var(--aura-cyan)", fontWeight: 600 }}>Online</span>
        </div>
        <button
          onClick={() => {
            if (window.confirm("Clear all conversation history with Hpi?")) {
              clearChatHistory();
            }
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-text-3)",
            width: 36,
            height: 36,
            borderRadius: 18,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginLeft: "auto",
            cursor: "pointer"
          }}
          title="Clean / Clear Conversation"
          aria-label="Clean conversation"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.filter(m => m && !isSystemPromptMessage(m)).map((m, idx) => (
          <div key={m.id || idx} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            <div style={{
              maxWidth: "85%",
              padding: "12px 16px",
              borderRadius: 18,
              borderBottomRightRadius: m.role === "user" ? 4 : 18,
              borderBottomLeftRadius: m.role === "assistant" ? 4 : 18,
              background: m.role === "user" ? "var(--aura-cyan)" : "var(--color-surface-h)",
              color: m.role === "user" ? "#000" : "var(--color-text)",
              fontSize: 14.5,
              lineHeight: 1.45,
              border: m.role === "assistant" ? "1px solid rgba(255,255,255,0.1)" : "none"
            }}>
              <MarkdownMessage content={m.content} role={m.role} />
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ alignSelf: "flex-start", background: "var(--color-surface-h)", padding: "12px 16px", borderRadius: 20, borderBottomLeftRadius: 4, border: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center", height: 20 }}>
              <span className="hpi-typing-dot" style={{ width: 6, height: 6, background: "var(--aura-cyan)", borderRadius: "50%", display: "inline-block", animation: "bounce 1.4s infinite ease-in-out both" }} />
              <span className="hpi-typing-dot" style={{ width: 6, height: 6, background: "var(--aura-cyan)", borderRadius: "50%", display: "inline-block", animation: "bounce 1.4s infinite ease-in-out both", animationDelay: "0.2s" }} />
              <span className="hpi-typing-dot" style={{ width: 6, height: 6, background: "var(--aura-cyan)", borderRadius: "50%", display: "inline-block", animation: "bounce 1.4s infinite ease-in-out both", animationDelay: "0.4s" }} />
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div style={{ alignSelf: "center", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 500, textAlign: "center", maxWidth: "90%" }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ 
        padding: "12px 20px", 
        paddingBottom: `calc(12px + env(safe-area-inset-bottom))`,
        background: "rgba(15,17,21,0.9)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "flex-end", gap: 12
      }}>
        <button 
          onClick={listening ? stopVoice : startVoice}
          style={{ 
            width: 44, height: 44, borderRadius: 22, 
            background: listening ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)", 
            color: listening ? "#EF4444" : "var(--text-secondary)", 
            border: listening ? "1px solid rgba(239, 68, 68, 0.3)" : "none", 
            display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 
          }}
        >
          {listening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        
        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={listening ? "Listening..." : "Ask HPI..."}
            rows={1}
            style={{ 
              width: "100%", background: "var(--color-surface-h)", border: "1px solid var(--color-border)", 
              borderRadius: 22, padding: "12px 16px", paddingRight: 44, color: "var(--color-text)", fontSize: 15,
              resize: "none", outline: "none", minHeight: 44, maxHeight: 120
            }}
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{ 
              position: "absolute", right: 6, bottom: 6, width: 32, height: 32, borderRadius: 16, 
              background: input.trim() ? "var(--aura-cyan)" : "transparent", 
              color: input.trim() ? "#000" : "var(--text-secondary)", 
              border: "none", display: "flex", justifyContent: "center", alignItems: "center", transition: "all 0.2s" 
            }}
          >
            <Send size={16} style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
