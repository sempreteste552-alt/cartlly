import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW: async (_swUrl, registration) => {
      await registration?.update();
    },
    onNeedRefresh: () => {
      updateSW(true);
    },
    onOfflineReady: () => {
      console.info("PWA ready for offline use");
    },
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
