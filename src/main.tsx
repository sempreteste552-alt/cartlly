import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Kill any cached service workers + caches in preview/iframe contexts
// (Lovable preview shows stale builds otherwise)
if (typeof window !== "undefined") {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app");

  if (isPreviewHost || isInIframe) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister().catch(() => {}));
      }).catch(() => {});
    }
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k).catch(() => {}));
      }).catch(() => {});
    }
  }
}

// Prevent pinch-zoom and double-tap zoom for app-like experience
if (typeof window !== "undefined") {
  // Block multi-touch pinch
  document.addEventListener("touchmove", (e) => {
    if ((e as TouchEvent).touches.length > 1) e.preventDefault();
  }, { passive: false });

  // Block double-tap zoom (iOS Safari)
  let lastTouch = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouch <= 350) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  // Block ctrl+wheel zoom and gesture events
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("wheel", (e) => {
    if ((e as WheelEvent).ctrlKey) e.preventDefault();
  }, { passive: false });
}

createRoot(document.getElementById("root")!).render(<App />);
