import { useState, useCallback } from "react";

export function getDeviceFingerprint(): string {
  const nav = navigator;
  const screen = window.screen;
  const raw = `${nav.userAgent}|${nav.language}|${screen.width}x${screen.height}|${screen.colorDepth}|${new Date().getTimezoneOffset()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `dev_${Math.abs(hash).toString(36)}`;
}

interface DeviceCheckResult {
  requires_otp: boolean;
  locked: boolean;
  locked_until?: string;
  reason?: string;
  trusted_device?: boolean;
}

export function useDeviceCheck() {
  const [checking, setChecking] = useState(false);

  const checkDevice = useCallback(async (userId: string): Promise<DeviceCheckResult> => {
    setChecking(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/check-device`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            device_fingerprint: getDeviceFingerprint(),
            ip_address: null,
            user_agent: navigator.userAgent,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (error) {
      console.error("Device check error:", error);
      return { requires_otp: false, locked: false };
    } finally {
      setChecking(false);
    }
  }, []);

  return { checkDevice, checking };
}
