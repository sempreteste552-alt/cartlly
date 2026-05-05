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

let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let loadingPromise: Promise<void> | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

async function ensureBuffer(): Promise<void> {
  if (audioBuffer) return;
  if (loadingPromise) return loadingPromise;
  const ctx = getCtx();
  if (!ctx) return;
  loadingPromise = (async () => {
    try {
      const res = await fetch(SEND_SOUND_URL);
      const arr = await res.arrayBuffer();
      audioBuffer = await ctx.decodeAudioData(arr);
    } catch {}
  })();
  return loadingPromise;
}

// Pre-warm the buffer on module load so the first play has zero delay
if (typeof window !== "undefined") {
  setTimeout(() => { void ensureBuffer(); }, 100);
}

// Fallback HTMLAudio element (in case Web Audio is blocked)
let fallbackAudio: HTMLAudioElement | null = null;
function getFallbackAudio(): HTMLAudioElement {
  if (!fallbackAudio) {
    fallbackAudio = new Audio(SEND_SOUND_URL);
    fallbackAudio.volume = 1.0;
    fallbackAudio.preload = "auto";
  }
  return fallbackAudio;
}

export function playMessageSentSound() {
  if (!isChatSoundsEnabled()) return;
  const ctx = getCtx();
  if (ctx && audioBuffer) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      const gain = ctx.createGain();
      // Volume amplificado (acima de 1.0 só funciona via Web Audio)
      gain.gain.value = 3.0;
      src.connect(gain).connect(ctx.destination);
      src.start(0);
      return;
    } catch {}
  }
  // Carrega buffer em background para próximas chamadas
  void ensureBuffer();
  // Fallback para HTMLAudio (volume máx 1.0)
  try {
    const a = getFallbackAudio();
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {}
}
