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

function getSystemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function readThemeState(storageKey: string) {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(storageKey);
  if (stored) return stored === "dark";
  return getSystemPrefersDark();
}

function emitThemeChange(storageKey: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(`theme-change-${storageKey}`));
}

export function ThemeToggle({ className, scope = "global", applyToRoot = true }: ThemeToggleProps) {
  const { dark, toggle } = useThemeScope(scope);

  useLayoutEffect(() => {
    if (applyToRoot) {
      document.documentElement.dataset.themeScope = scope;
      document.documentElement.classList.toggle("dark", dark);
    }
  }, [dark, applyToRoot, scope]);

  // Cleanup: when unmounting an applyToRoot toggle, remove the class
  // so the next layout can set its own.
  useEffect(() => {
    return () => {
      if (applyToRoot && document.documentElement.dataset.themeScope === scope) {
        document.documentElement.classList.remove("dark");
        delete document.documentElement.dataset.themeScope;
      }
    };
  }, [applyToRoot, scope]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
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
  const [dark, setDarkState] = useState(() => readThemeState(storageKey));

  useEffect(() => {
    setDarkState(readThemeState(storageKey));
  }, [storageKey]);

  // Listen for storage changes from ThemeToggle (same tab via custom event)
  useEffect(() => {
    const syncTheme = () => {
      setDarkState(readThemeState(storageKey));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        syncTheme();
      }
    };

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (!localStorage.getItem(storageKey)) {
        syncTheme();
      }
    };

    window.addEventListener(`theme-change-${storageKey}`, syncTheme);
    window.addEventListener("storage", handleStorage);
    media?.addEventListener?.("change", handleSystemThemeChange);

    return () => {
      window.removeEventListener(`theme-change-${storageKey}`, syncTheme);
      window.removeEventListener("storage", handleStorage);
      media?.removeEventListener?.("change", handleSystemThemeChange);
    };
  }, [storageKey]);

  const setDark = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    setDarkState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      localStorage.setItem(storageKey, next ? "dark" : "light");
      emitThemeChange(storageKey);
      return next;
    });
  }, [storageKey]);

  const toggle = useCallback(() => {
    setDark((current) => !current);
  }, [setDark]);

  return { dark, setDark, toggle };
}
