export function getOrCreateChatSessionId() {
  if (typeof window === "undefined") return null;

  let sessionId = window.localStorage.getItem("chat_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.localStorage.setItem("chat_session_id", sessionId);
  }

  return sessionId;
}
