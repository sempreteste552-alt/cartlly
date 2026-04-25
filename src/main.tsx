import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Note: Removing automatic service worker/cache clearing to improve performance
// Only clear if explicitly needed for breaking changes

createRoot(document.getElementById("root")!).render(<App />);
