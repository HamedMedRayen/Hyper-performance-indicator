// Central reactive storage manager for Hpi AI Chat history

const STORAGE_KEY = "hpi_chat_history_v1";
const EVENT_NAME = "hpi-chat-updated";

const DEFAULT_WELCOME = {
  role: "assistant",
  content: "Hey, I'm Hpi 👋 Your AI fitness coach. Ask me anything or tap the call icon to talk live!",
};

/**
 * Checks if a message is a leaked system prompt or internal action block.
 */
export function isSystemPromptMessage(msg) {
  if (!msg) return true;
  if (msg.role === "system") return true;
  const content = typeof msg.content === "string" ? msg.content : (msg.text || "");
  if (!content || typeof content !== "string") return false;
  const lower = content.toLowerCase();
  if (
    lower.includes("you are hpi, the ambient agentic system operator") ||
    lower.includes("=== medical & lab report analysis ===") ||
    lower.includes("=== hpi's mandate") ||
    lower.includes("=== athlete profile & onboarding data ===") ||
    lower.includes("critical rule: do not use any emojis")
  ) {
    return true;
  }
  return false;
}

/**
 * Retrieve saved chat history array from localStorage.
 */
export function getChatHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [DEFAULT_WELCOME];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const sanitized = parsed.filter((m) => m && !isSystemPromptMessage(m));
      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch (e) {
    console.warn("Error reading hpi_chat_history from storage:", e);
  }
  return [DEFAULT_WELCOME];
}

/**
 * Save full chat history array to localStorage and notify all subscribers.
 */
export function saveChatHistory(messages) {
  try {
    if (Array.isArray(messages)) {
      const sanitized = messages.filter((m) => m && !isSystemPromptMessage(m));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: sanitized }));
    }
  } catch (e) {
    console.warn("Error saving hpi_chat_history to storage:", e);
  }
}

/**
 * Append one message to saved chat history and trigger update event.
 */
export function addChatMessage(message) {
  if (!message || isSystemPromptMessage(message)) return getChatHistory();
  const current = getChatHistory();
  // Prevent exact duplicate consecutive messages
  const last = current[current.length - 1];
  if (last && last.role === message.role && last.content?.trim() === message.content?.trim()) {
    return current;
  }
  const next = [...current, message];
  saveChatHistory(next);
  return next;
}

/**
 * Append multiple messages (e.g. from Vapi voice call session) to chat history.
 */
export function addChatMessages(newMessages) {
  if (!Array.isArray(newMessages) || newMessages.length === 0) return getChatHistory();
  const current = getChatHistory();
  const filteredNew = newMessages.filter(
    (nm) => nm && nm.content && nm.content.trim() && !isSystemPromptMessage(nm)
  );
  if (filteredNew.length === 0) return current;

  const next = [...current, ...filteredNew];
  saveChatHistory(next);
  return next;
}

/**
 * Subscribe to chat history updates.
 * @param {Function} callback Callback receiving updated messages array.
 * @returns {Function} Unsubscribe cleanup function.
 */
export function subscribeChatHistory(callback) {
  const handler = (e) => {
    if (e && e.detail) {
      callback(e.detail.filter((m) => m && !isSystemPromptMessage(m)));
    } else {
      callback(getChatHistory());
    }
  };

  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * Clear stored chat history and reset to welcome message.
 */
export function clearChatHistory() {
  saveChatHistory([DEFAULT_WELCOME]);
}

