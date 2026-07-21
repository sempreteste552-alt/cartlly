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

// Zoom prevention removed — was interfering with native scroll on some devices.
// Viewport meta in index.html already controls user-scalable behavior.

createRoot(document.getElementById("root")!).render(<App />);
