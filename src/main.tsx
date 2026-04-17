import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    void Promise.all(registrations.map((registration) => registration.unregister()));
  });
}

if ("caches" in window) {
  void caches.keys().then((cacheKeys) => {
    void Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
