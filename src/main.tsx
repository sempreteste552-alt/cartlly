import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyRuntimePwaManifest } from "./lib/runtimePwaManifest";

applyRuntimePwaManifest();

createRoot(document.getElementById("root")!).render(<App />);
