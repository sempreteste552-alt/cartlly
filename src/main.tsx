import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyRuntimePwaManifest } from "./lib/runtimePwaManifest";

// Apply a fallback manifest based on the current URL.
// Each layout (LojaLayout, AdminLayout) will override this
// with tenant-specific data once loaded.
applyRuntimePwaManifest();

createRoot(document.getElementById("root")!).render(<App />);
