// Lightweight chat sound utility shared by admin support and storefront chat.
// User can toggle via localStorage flag "chat_sounds_enabled" ("0" disables).

const SEND_SOUND_URL = "/sounds/message-sent.mp3";
const STORAGE_KEY = "chat_sounds_enabled";

export function isChatSoundsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setChatSoundsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {}
}

let sendAudio: HTMLAudioElement | null = null;
function getSendAudio(): HTMLAudioElement {
  if (!sendAudio) {
    sendAudio = new Audio(SEND_SOUND_URL);
    sendAudio.volume = 0.35;
    sendAudio.preload = "auto";
  }
  return sendAudio;
}

export function playMessageSentSound() {
  if (!isChatSoundsEnabled()) return;
  try {
    const a = getSendAudio();
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {}
}
