const FALLBACK_APP_ORIGIN = "https://cartlly.lovable.app";

function isPreviewHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovableproject.com")
  );
}

export function getAuthRedirectOrigin() {
  if (typeof window === "undefined") {
    return FALLBACK_APP_ORIGIN;
  }

  try {
    const currentUrl = new URL(window.location.href);
    return isPreviewHost(currentUrl.hostname) ? FALLBACK_APP_ORIGIN : currentUrl.origin;
  } catch {
    return FALLBACK_APP_ORIGIN;
  }
}

export function getPasswordResetRedirectUrl() {
  return `${getAuthRedirectOrigin()}/reset-password`;
}

export function getPasswordRecoveryErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const waitMatch = message.match(/after\s+(\d+)\s+seconds?/i) || message.match(/ap[oó]s\s+(\d+)\s+segundos?/i);

  if (
    message.includes("over_email_send_rate_limit") ||
    /for security purposes/i.test(message) ||
    waitMatch
  ) {
    const seconds = waitMatch?.[1];
    return seconds
      ? `Você acabou de solicitar um link. Aguarde ${seconds} segundos e tente novamente.`
      : "Você acabou de solicitar um link. Aguarde alguns segundos e tente novamente.";
  }

  return message || "Não foi possível enviar o link de redefinição agora.";
}