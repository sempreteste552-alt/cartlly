import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Theme toggle with optional scope isolation.
 * Each scope (e.g. "superadmin", "admin", "store-slug") gets its own
 * localStorage key so toggling in one context doesn't affect another.
 *
 * When used inside a store, it only applies the dark class on the
 * store wrapper element — not on <html>.
 */
interface ThemeToggleProps {
  className?: string;
  /** Unique scope key. Defaults to "global". */
  scope?: string;
  /**
   * When true the toggle applies / removes the `dark` class on
   * document.documentElement (default behaviour for admin panels).
   * When false (store usage) it does NOT touch <html> — the parent
   * component reads the state via the returned value or via a callback.
   */
  applyToRoot?: boolean;
}

function getStorageKey(scope: string) {
  return `theme_${scope}`;
}

export function ThemeToggle({ className, scope = "global", applyToRoot = true }: ThemeToggleProps) {
  const storageKey = getStorageKey(scope);

  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored) return stored === "dark";
      // Fall back to system preference
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    }
    return false;
  });

  useLayoutEffect(() => {
    if (applyToRoot) {
      if (dark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [dark, applyToRoot]);

  // Cleanup: when unmounting an applyToRoot toggle, remove the class
  // so the next layout can set its own.
  useEffect(() => {
    return () => {
      if (applyToRoot) {
        document.documentElement.classList.remove("dark");
      }
    };
  }, [applyToRoot]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        setDark((d) => {
          const next = !d;
          localStorage.setItem(storageKey, next ? "dark" : "light");
          window.dispatchEvent(new Event(`theme-change-${storageKey}`));
          return next;
        });
      }}
      className={className}
      title={dark ? "Modo claro" : "Modo escuro"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

/**
 * Hook to read theme state for a given scope without rendering a button.
 */
export function useThemeScope(scope: string) {
  const storageKey = getStorageKey(scope);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored) return stored === "dark";
      return false;
    }
    return false;
  });

  // Listen for storage changes from ThemeToggle (same tab via custom event)
  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem(storageKey);
      setDark(stored === "dark");
    };
    window.addEventListener(`theme-change-${storageKey}`, handler);
    return () => window.removeEventListener(`theme-change-${storageKey}`, handler);
  }, [storageKey]);

  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem(storageKey, next ? "dark" : "light");
      window.dispatchEvent(new Event(`theme-change-${storageKey}`));
      return next;
    });
  }, [storageKey]);

  return { dark, toggle };
}
